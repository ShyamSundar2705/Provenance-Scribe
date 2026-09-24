import re
from typing import Literal

from app.schemas.transcript import Transcript, TranscriptSegment

# Heuristic marker words for Latin-script Tanglish - not a classifier. Extend as needed.
_TAMIL_MARKERS = {
    "vandhu", "valikuthu", "irukku", "iruku", "neram", "konjam", "ila", "illa", "la", "ku",
    "raanga", "sollraanga", "kashtam", "enaku", "enakku", "romba", "nalla", "ennaku",
    "aana", "aanaa", "pannunga", "sapdanum", "sappadu", "thalai", "vayiru", "kaichal",
    "irumal", "irumbal", "vali", "podunga", "saptingala", "yaen", "epdi", "eppadi", "naan",
    "unga", "ungaluku", "irukka", "irukkaa", "illai", "mathirai", "maathirai",
}
_ENGLISH_ONLY = re.compile(r"^[A-Za-z0-9\s.,;:!?'\"()\-/%+]*$")


def detect_language_mix(raw_text: str) -> str:
    words = set(re.findall(r"[a-z]+", raw_text.lower()))
    if words & _TAMIL_MARKERS:
        return "tamil-english"
    if _ENGLISH_ONLY.match(raw_text):
        return "english"
    return "tamil"


def build_transcript(raw_text: str, source: Literal["typed", "synthetic", "asr"]) -> Transcript:
    """Minimal segmentation: a simple sentence split with offsets into raw_text."""
    language_mix = detect_language_mix(raw_text)
    lang = {"tamil-english": "mixed", "english": "en", "tamil": "ta"}[language_mix]
    segments = [
        TranscriptSegment(text=m.group(0), lang=lang, char_start=m.start(), char_end=m.end())
        for m in re.finditer(r"[^.?!\n]+[.?!]?", raw_text)
        if m.group(0).strip()
    ]
    return Transcript(
        raw_text=raw_text, segments=segments, language_mix=language_mix, source=source
    )
