from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    get_current_doctor,
    hash_password,
    verify_password,
)
from app.core.db import get_db
from app.models.db_models import AuditLog, Doctor
from app.schemas.auth import (
    ChangePasswordRequest,
    DoctorProfile,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.execute(
        select(Doctor).where(
            (Doctor.email == body.email) | (Doctor.doctor_id == body.doctor_id)
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A doctor with this email or doctor_id already exists",
        )

    doctor = Doctor(
        doctor_id=body.doctor_id,
        email=body.email,
        full_name=body.full_name,
        specialisation=body.specialisation,
        hashed_password=hash_password(body.password),
    )
    db.add(doctor)
    db.add(
        AuditLog(
            doctor_id=doctor.doctor_id,
            action="DOCTOR_REGISTERED",
            session_id=None,
            detail=f"Doctor {doctor.doctor_id} registered",
        )
    )
    await db.commit()
    await db.refresh(doctor)

    token = create_access_token(doctor)
    return TokenResponse(
        access_token=token,
        doctor_id=doctor.doctor_id,
        full_name=doctor.full_name,
        email=doctor.email,
        specialisation=doctor.specialisation,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await db.execute(select(Doctor).where(Doctor.email == form_data.username))
    doctor = result.scalar_one_or_none()
    if doctor is None or not verify_password(form_data.password, doctor.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    doctor.last_login = datetime.now(timezone.utc)
    db.add(
        AuditLog(
            doctor_id=doctor.doctor_id,
            action="DOCTOR_LOGIN",
            session_id=None,
            detail=f"Doctor {doctor.doctor_id} logged in",
        )
    )
    await db.commit()
    await db.refresh(doctor)

    token = create_access_token(doctor)
    return TokenResponse(
        access_token=token,
        doctor_id=doctor.doctor_id,
        full_name=doctor.full_name,
        email=doctor.email,
        specialisation=doctor.specialisation,
    )


@router.get("/me", response_model=DoctorProfile)
async def me(doctor: Doctor = Depends(get_current_doctor)) -> DoctorProfile:
    return DoctorProfile.model_validate(doctor)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    doctor: Doctor = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
) -> None:
    if not verify_password(body.current_password, doctor.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    doctor.hashed_password = hash_password(body.new_password)
    db.add(
        AuditLog(
            doctor_id=doctor.doctor_id,
            action="PASSWORD_CHANGED",
            session_id=None,
            detail=f"Doctor {doctor.doctor_id} changed password",
        )
    )
    await db.commit()
