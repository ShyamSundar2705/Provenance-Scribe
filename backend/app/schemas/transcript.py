from typing import Literal

from pydantic import BaseModel


class TranscriptSegment(BaseModel):
    text: str
    lang: str  # "en" | "ta" | "mixed"
    confidence: float = 1.0
    char_start: int  # offset into raw_text (NOT time)
    char_end: int


class Transcript(BaseModel):
    """The one stable interface crossing the TEXT BOUNDARY."""

    raw_text: str  # Tanglish, Latin script - the provenance anchor, never mutated
    segments: list[TranscriptSegment]
    language_mix: str  # "tamil-english" | "english" | "tamil"
    source: Literal["typed", "synthetic", "asr"]
