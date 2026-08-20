from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    doctor_id: str
    email: EmailStr
    full_name: str
    specialisation: str | None = None
    password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    doctor_id: str
    full_name: str
    email: EmailStr
    specialisation: str | None = None


class DoctorProfile(BaseModel):
    doctor_id: str
    full_name: str
    email: EmailStr
    specialisation: str | None = None

    model_config = {"from_attributes": True}
