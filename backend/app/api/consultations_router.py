from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_doctor
from app.core.db import get_db
from app.models.db_models import (
    AuditLog,
    ClinicalNote,
    ConsultationSession,
    Doctor,
    FactCheck,
    VerificationRun,
)
from app.models.db_models import Transcript as TranscriptRow
from app.schemas.consultations import (
    ConsentRequest,
    ConsultationCreateRequest,
    ConsultationDetail,
    ConsultationListItem,
    FactCheckOut,
    NoteOut,
    TranscriptCreateRequest,
    TranscriptOut,
)
from app.services.note_pipeline import note_graph
from app.services.transcript_service import build_transcript
from app.services.verification import build_note_text, verify_graph

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
    checks = (
        await db.execute(
            select(FactCheck)
            .where(FactCheck.session_id == session.id)
            .order_by(FactCheck.created_at)
        )
    ).scalars().all()
    detail.fact_checks = [FactCheckOut.model_validate(c) for c in checks]
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


@router.post("/{consultation_id}/verify", response_model=list[FactCheckOut])
async def verify_consultation(
    consultation_id: str,
    doctor: Doctor = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
) -> list[FactCheckOut]:
    session = await _get_owned_session(db, consultation_id, doctor)
    note = (
        await db.execute(select(ClinicalNote).where(ClinicalNote.session_id == session.id))
    ).scalar_one_or_none()
    row = (
        await db.execute(select(TranscriptRow).where(TranscriptRow.session_id == session.id))
    ).scalar_one_or_none()
    if note is None or row is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Note required before verification"
        )

    # Only Subjective + Objective are checked; Assessment/Plan are structurally excluded.
    note_text = build_note_text(note.subjective, note.objective)
    try:
        state = await verify_graph.ainvoke(
            {
                "raw_text": row.raw_text,
                "note_text": note_text,
                "intake_age": session.patient_age,
                "intake_gender": session.patient_gender,
            }
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Verification service failed"
        )

    run = (
        await db.execute(select(VerificationRun).where(VerificationRun.session_id == session.id))
    ).scalar_one_or_none()
    if run is None:
        run = VerificationRun(session_id=session.id)
        db.add(run)
    run.note_text = note_text
    run.note_entities = state["note_entities"]
    run.transcript_entities = state["transcript_entities"]

    await db.execute(delete(FactCheck).where(FactCheck.session_id == session.id))
    checks = [FactCheck(session_id=session.id, **r) for r in state["results"]]
    db.add_all(checks)

    session.status = "checked"
    db.add(
        AuditLog(
            doctor_id=doctor.doctor_id,
            action="VERIFICATION_RUN",
            session_id=session.id,
            detail=f"Verification run: {len(checks)} note facts checked",
        )
    )
    await db.commit()
    return [FactCheckOut.model_validate(c) for c in checks]
