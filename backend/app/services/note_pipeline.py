import json
import re
from typing import TypedDict

import httpx
from langgraph.graph import END, START, StateGraph

from app.core.config import settings
from app.schemas.transcript import Transcript

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SOAP_SYSTEM_PROMPT = (
    "You are a clinical documentation assistant. You will receive the raw transcript of an "
    "outpatient consultation, spoken in code-mixed Tamil-English (Tanglish, written in Latin "
    "script). Interpret the code-mixed speech and write a structured clinical note in English "
    "with four sections: Subjective, Objective, Assessment, Plan. "
    'Return JSON only, with exactly the keys "subjective", "objective", "assessment", "plan", '
    "each a string. No markdown, no code fences, no extra text."
)

_KEYS = ("subjective", "objective", "assessment", "plan")


class NoteState(TypedDict, total=False):
    transcript: Transcript
    note: dict[str, str]
    model_used: str


def _parse_note(content: str) -> dict[str, str] | None:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.IGNORECASE)
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    note: dict[str, str] = {}
    for k in _KEYS:
        v = data.get(k)
        if v is None:
            note[k] = ""
        elif isinstance(v, str):
            note[k] = v
        else:
            note[k] = json.dumps(v, ensure_ascii=False)
    return note


async def _call_groq(raw_text: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            json={
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": SOAP_SYSTEM_PROMPT},
                    {"role": "user", "content": raw_text},
                ],
                "temperature": 0.2,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def generate_note(state: NoteState) -> NoteState:
    raw_text = state["transcript"].raw_text
    content = ""
    for _ in range(2):  # retry once on unparseable output
        content = await _call_groq(raw_text)
        note = _parse_note(content)
        if note is not None:
            return {"note": note, "model_used": settings.GROQ_MODEL}
    # Fallback: keep the raw model text rather than crash.
    return {
        "note": {"subjective": content, "objective": "", "assessment": "", "plan": ""},
        "model_used": settings.GROQ_MODEL,
    }


def build_note_graph():
    graph = StateGraph(NoteState)
    graph.add_node("generate_note", generate_note)
    graph.add_edge(START, "generate_note")
    graph.add_edge("generate_note", END)
    return graph.compile()


note_graph = build_note_graph()
