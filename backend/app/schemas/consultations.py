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


class TranscriptCreateRequest(BaseModel):
    raw_text: str = Field(min_length=1)
    source: Literal["typed", "synthetic"] = "typed"


class TranscriptOut(BaseModel):
    raw_text: str
    language_mix: str
    source: str

    model_config = {"from_attributes": True}


class NoteOut(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str
    model_used: str

    model_config = {"from_attributes": True}


class FactCheckOut(BaseModel):
    id: str
    entity_type: str
    entity_value: str
    tier: str
    note_quote: str | None
    note_char_start: int | None
    note_char_end: int | None
    transcript_quote: str | None
    transcript_char_start: int | None
    transcript_char_end: int | None
    reason: str
    method: str

    model_config = {"from_attributes": True}


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
    transcript: TranscriptOut | None = None
    note: NoteOut | None = None
    fact_checks: list[FactCheckOut] = []

    model_config = {"from_attributes": True}
