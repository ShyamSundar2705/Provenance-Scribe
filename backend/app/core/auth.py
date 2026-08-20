from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.models.db_models import Doctor

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(doctor: Doctor) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": doctor.doctor_id,
        "email": doctor.email,
        "exp": now + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS),
        "iat": now,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_doctor(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Doctor:
    payload = decode_token(token)
    doctor_id = payload.get("sub")
    result = await db.execute(select(Doctor).where(Doctor.doctor_id == doctor_id))
    doctor = result.scalar_one_or_none()
    if doctor is None or not doctor.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Doctor not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return doctor
