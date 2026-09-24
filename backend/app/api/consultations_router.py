from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_doctor
from app.core.db import get_db
from app.models.db_models import AuditLog, ClinicalNote, ConsultationSession, Doctor
from app.models.db_models import Transcript as TranscriptRow
from app.schemas.consultations import (
    ConsentRequest,
    ConsultationCreateRequest,
    ConsultationDetail,
    ConsultationListItem,
    NoteOut,
    TranscriptCreateRequest,
    TranscriptOut,
)
from app.services.note_pipeline import note_graph
from app.services.transcript_service import build_transcript

router = APIRouter(prefix="/api/v1/consultations", tags=["consultations"])


async def _get_owned_session(
    db: AsyncSession, consultation_id: str, doctor: Doctor
) -> ConsultationSession:
    result = await db.execute(
        select(ConsultationSession).where(
            ConsultationSession.id == consultation_id,
            ConsultationSession.doctor_id == doctor.doctor_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    return session


async def _detail(db: AsyncSession, session: ConsultationSession) -> ConsultationDetail:
    transcript = (
        await db.execute(select(TranscriptRow).where(TranscriptRow.session_id == session.id))
    ).scalar_one_or_none()
    note = (
        await db.execute(select(ClinicalNote).where(ClinicalNote.session_id == session.id))
    ).scalar_one_or_none()
    detail = ConsultationDetail.model_validate(session)
    detail.transcript = TranscriptOut.model_validate(transcript) if transcript else None
    detail.note = NoteOut.model_validate(note) if note else None
    return detail


@router.post("/", response_model=ConsultationDetail, status_code=status.HTTP_201_CREATED)
async def create_consultation(
    body: ConsultationCreateRequest,
    doctor: Doctor = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
) -> ConsultationDetail:
    session = ConsultationSession(
        doctor_id=doctor.doctor_id,
        patient_name=body.patient_name,
        patient_age=body.patient_age,
        patient_gender=body.patient_gender.value,
    )
    db.add(session)
    await db.flush()
    db.add(
        AuditLog(
            doctor_id=doctor.doctor_id,
            action="CONSULTATION_CREATED",
            session_id=session.id,
            detail=f"Consultation created for patient {session.patient_name}",
        )
    )
    await db.commit()
    await db.refresh(session)
    return await _detail(db, session)


@router.get("/", response_model=list[ConsultationListItem])
async def list_consultations(
    doctor: Doctor = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
) -> list[ConsultationListItem]:
    result = await db.execute(
        select(ConsultationSession)
        .where(ConsultationSession.doctor_id == doctor.doctor_id)
        .order_by(ConsultationSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return [ConsultationListItem.model_validate(s) for s in sessions]


@router.get("/{consultation_id}", response_model=ConsultationDetail)
async def get_consultation(
    consultation_id: str,
    doctor: Doctor = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
) -> ConsultationDetail:
    result = await db.execute(
        select(ConsultationSession).where(
            ConsultationSession.id == consultation_id,
            ConsultationSession.doctor_id == doctor.doctor_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    return await _detail(db, session)


@router.post("/{consultation_id}/consent", response_model=ConsultationDetail)
async def record_consent(
    consultation_id: str,
    body: ConsentRequest,
    doctor: Doctor = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
) -> ConsultationDetail:
    result = await db.execute(
        select(ConsultationSession).where(
            ConsultationSession.id == consultation_id,
            ConsultationSession.doctor_id == doctor.doctor_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    if not session.consent_given:
        session.consent_given = True
        session.consent_at = datetime.now(timezone.utc)
        db.add(
            AuditLog(
                doctor_id=doctor.doctor_id,
                action="CONSENT_RECORDED",
                session_id=session.id,
                detail=f"Consent recorded for patient {session.patient_name}",
            )
        )
        await db.commit()
        await db.refresh(session)

    return await _detail(db, session)


@router.post("/{consultation_id}/transcript", response_model=TranscriptOut)
async def add_transcript(
    consultation_id: str,
    body: TranscriptCreateRequest,
    doctor: Doctor = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
) -> TranscriptOut:
    session = await _get_owned_session(db, consultation_id, doctor)
    if not session.consent_given:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Consent required before capture"
        )

    transcript = build_transcript(body.raw_text, body.source)
    row = (
        await db.execute(select(TranscriptRow).where(TranscriptRow.session_id == session.id))
    ).scalar_one_or_none()
    if row is None:
        row = TranscriptRow(session_id=session.id)
        db.add(row)
    row.raw_text = transcript.raw_text
    row.segments = [seg.model_dump() for seg in transcript.segments]
    row.language_mix = transcript.language_mix
    row.source = transcript.source

    session.status = "transcribed"
    db.add(
        AuditLog(
            doctor_id=doctor.doctor_id,
            action="TRANSCRIPT_ADDED",
            session_id=session.id,
            detail=f"Transcript added (source={transcript.source}, {transcript.language_mix})",
        )
    )
    await db.commit()
    await db.refresh(row)
    return TranscriptOut.model_validate(row)


@router.post("/{consultation_id}/note", response_model=NoteOut)
async def generate_note(
    consultation_id: str,
    doctor: Doctor = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
) -> NoteOut:
    session = await _get_owned_session(db, consultation_id, doctor)
    row = (
        await db.execute(select(TranscriptRow).where(TranscriptRow.session_id == session.id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Transcript required before note generation"
        )

    transcript = build_transcript(row.raw_text, row.source)  # type: ignore[arg-type]
    try:
        result = await note_graph.ainvoke({"transcript": transcript})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Note generation service failed"
        )
    fields = result["note"]

    note = (
        await db.execute(select(ClinicalNote).where(ClinicalNote.session_id == session.id))
    ).scalar_one_or_none()
    if note is None:
        note = ClinicalNote(session_id=session.id)
        db.add(note)
    note.subjective = fields["subjective"]
    note.objective = fields["objective"]
    note.assessment = fields["assessment"]
    note.plan = fields["plan"]
    note.model_used = result["model_used"]

    session.status = "noted"
    db.add(
        AuditLog(
            doctor_id=doctor.doctor_id,
            action="NOTE_GENERATED",
            session_id=session.id,
            detail=f"Note generated with {note.model_used}",
        )
    )
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note)
