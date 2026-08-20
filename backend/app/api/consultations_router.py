from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_doctor
from app.core.db import get_db
from app.models.db_models import AuditLog, ConsultationSession, Doctor
from app.schemas.consultations import (
    ConsultationCreateRequest,
    ConsultationDetail,
    ConsultationListItem,
)

router = APIRouter(prefix="/api/v1/consultations", tags=["consultations"])


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
    return ConsultationDetail.model_validate(session)


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
    return ConsultationDetail.model_validate(session)
