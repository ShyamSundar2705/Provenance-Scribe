from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class PatientGender(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class ConsultationCreateRequest(BaseModel):
    patient_name: str = Field(min_length=1)
    patient_age: int = Field(ge=0, le=120)
    patient_gender: PatientGender


class ConsentRequest(BaseModel):
    consent: Literal[True]


class ConsultationListItem(BaseModel):
    id: str
    patient_name: str
    patient_age: int
    patient_gender: str
    status: str
    consent_given: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConsultationDetail(BaseModel):
    id: str
    doctor_id: str
    patient_name: str
    patient_age: int
    patient_gender: str
    status: str
    consent_given: bool
    consent_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
