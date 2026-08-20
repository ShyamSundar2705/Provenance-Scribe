from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PatientGender(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class ConsultationCreateRequest(BaseModel):
    patient_name: str = Field(min_length=1)
    patient_age: int = Field(ge=0, le=120)
    patient_gender: PatientGender


class ConsultationListItem(BaseModel):
    id: str
    patient_name: str
    patient_age: int
    patient_gender: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConsultationDetail(BaseModel):
    id: str
    doctor_id: str
    patient_name: str
    patient_age: int
    patient_gender: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
