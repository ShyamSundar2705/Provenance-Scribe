"""C2 + C3: closed-schema extraction (finder) and assertion-level comparison (judge).

Verdicts are decided by asserted status (affirmed / denied / questioned), never by token
overlap. Clear cases are decided deterministically; only ambiguity goes to the LLM.
Assessment and Plan are structurally excluded: only Subjective/Objective are ever checked.
"""

import json
import re
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.services import groq_client

STATUSES = {"affirmed", "denied", "questioned"}
TIERS = {"verified", "requires_confirmation", "potential_conflict"}

# Closed schema. chief_complaint and symptom are aligned as one group.
ENTITY_TYPES = [
    "symptom", "chief_complaint", "medication", "allergy", "diagnosis",
    "age", "gender", "pregnancy", "vital", "number",
]
_ALIGN_GROUP = {"chief_complaint": "symptom"}


def build_note_text(subjective: str, objective: str) -> str:
    """The text C2 extracts from on the note side (Subjective + Objective ONLY).

    Note-side char offsets index into this string. Assessment/Plan are never included.
    """
    return f"Subjective:\n{subjective}\n\nObjective:\n{objective}"


EXTRACT_SYSTEM = (
    "You extract a CLOSED set of safety-critical facts from clinical text. You are a finder, "
    "not a judge: report what the text itself asserts. The text may be a code-mixed "
    "Tamil-English (Tanglish, Latin script) consultation transcript: interpret cues like "
    '"ila"/"illa"/"illai" (no), "irukku"/"iruku" (there is/have), "valikuthu" (hurts), '
    "and transliterated terms.\n"
    f"Allowed types: {', '.join(ENTITY_TYPES)}. Do NOT extract clinical reasoning, "
    "differentials or plans.\n"
    'Return JSON only: {"entities":[{"type":..., "value":..., "detail":..., "status":..., '
    '"quote":...}]}.\n'
    '- value: short normalised English identity, lowercase (e.g. "cough", "amoxicillin", '
    '"penicillin", "blood pressure", "age", "gender").\n'
    "- detail: dose/frequency/duration for medication, the number for vital/number/age, "
    '"male"/"female"/"other" for gender; else "" (empty).\n'
    '- status: "affirmed" (present/stated), "denied" (explicitly absent/negated), or '
    '"questioned" (asked about or uncertain) - as asserted in THIS text, in context.\n'
    "- quote: an EXACT verbatim substring of the text supporting the fact (for a denial, "
    "include the negation cue).\n"
    "No markdown, no code fences, no extra text."
)

ADJUDICATE_SYSTEM = (
    "You adjudicate whether a fact in a clinical note is supported by a consultation "
    "transcript's extracted facts. Decide by asserted MEANING and polarity (affirmed / "
    "denied / questioned), never by word overlap. For each item, pick the transcript "
    "candidate that refers to the same fact (or null if none does) and a tier:\n"
    '- "verified": the transcript explicitly supports the note fact with the same polarity '
    "and values.\n"
    '- "potential_conflict": the transcript contradicts it (denied vs affirmed, different '
    "dose/number/allergy).\n"
    '- "requires_confirmation": the transcript does not clearly state it or is ambiguous.\n'
    "Do not flag defensively: if clearly supported, answer verified.\n"
    'Return JSON only: {"results":[{"id":<int>,"aligned_index":<int|null>,"tier":...,'
    '"reason":"<one line>"}]}. No markdown, no code fences.'
)


def _norm(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _norm_detail(s: Any) -> str:
    return re.sub(r"[\s,]", "", str(s or "").lower())


def _locate(text: str, quote: str, used: set[tuple[str, int]]) -> tuple[int, int] | None:
    """Offsets of a verbatim quote in text (computed here, not trusted from the LLM)."""
    if not quote:
        return None
    for hay, needle in ((text, quote), (text.lower(), quote.lower())):
        start = 0
        while True:
            i = hay.find(needle, start)
            if i < 0:
                break
            if (quote, i) not in used:
                used.add((quote, i))
                return i, i + len(needle)
            start = i + 1
    return None


def _clean_entities(data: Any, text: str) -> list[dict] | None:
    items = data.get("entities") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return None
    used: set[tuple[str, int]] = set()
    out: list[dict] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        etype, status = _norm(it.get("type")), _norm(it.get("status"))
        value = _norm(it.get("value"))
        if etype not in ENTITY_TYPES or status not in STATUSES or not value:
            continue
        quote = str(it.get("quote") or "")
        span = _locate(text, quote, used)
        out.append(
            {
                "type": etype,
                "value": value,
                "detail": str(it.get("detail") or "").strip(),
                "status": status,
                "quote": text[span[0] : span[1]] if span else quote,
                "char_start": span[0] if span else None,
                "char_end": span[1] if span else None,
            }
        )
    return out


async def extract_from_text(text: str, label: str) -> list[dict]:
    """One extraction pass over one side's text. Retries once on malformed output."""
    for _ in range(2):
        content = await groq_client.groq_chat(EXTRACT_SYSTEM, f"Text ({label}):\n{text}")
        entities = _clean_entities(groq_client.parse_json(content), text)
        if entities is not None:
            return entities
    raise ValueError(f"Extraction failed for {label}: malformed model output")


class VerifyState(TypedDict, total=False):
    raw_text: str
    note_text: str
    intake_age: int
    intake_gender: str
    note_entities: list[dict]
    transcript_entities: list[dict]
    results: list[dict]
    pending: list[dict]


async def extract_entities(state: VerifyState) -> VerifyState:
    return {
        "note_entities": await extract_from_text(state["note_text"], "clinical note"),
        "transcript_entities": await extract_from_text(
            state["raw_text"], "consultation transcript"
        ),
    }


def _result(note: dict, tier: str, reason: str, method: str, t: dict | None) -> dict:
    return {
        "entity_type": note["type"],
        "entity_value": note["value"] + (f" ({note['detail']})" if note["detail"] else ""),
        "tier": tier,
        "note_quote": note["quote"],
        "note_char_start": note["char_start"],
        "note_char_end": note["char_end"],
        "transcript_quote": t["quote"] if t else None,
        "transcript_char_start": t["char_start"] if t else None,
        "transcript_char_end": t["char_end"] if t else None,
        "reason": reason,
        "method": method,
    }


def _compare_intake(note: dict, state: VerifyState) -> dict | None:
    """Age/gender: the S2 intake values are ground truth. Deterministic."""
    if note["status"] != "affirmed":
        return None
    if note["type"] == "age":
        m = re.search(r"\d+", note["detail"] or note["value"])
        if not m:
            return None
        ok = int(m.group()) == state["intake_age"]
        what, truth = "age", str(state["intake_age"])
    elif note["type"] == "gender":
        g = _norm(note["detail"] or note["value"])
        if g not in {"male", "female", "other"}:
            return None
        ok = g == _norm(state["intake_gender"])
        what, truth = "gender", state["intake_gender"]
    else:
        return None
    return _result(
        note,
        "verified" if ok else "potential_conflict",
        f"Matches intake {what} ({truth})" if ok else f"Note {what} differs from intake {what} ({truth})",
        "deterministic",
        None,
    )


def _decide(note: dict, t: dict) -> dict | None:
    """Deterministic status comparison for two aligned facts; None => ambiguous (LLM)."""
    ns, ts = note["status"], t["status"]
    if "questioned" in (ns, ts):
        return None
    if ns != ts:
        return _result(
            note, "potential_conflict",
            f"Note asserts '{ns}' but the transcript asserts '{ts}'", "deterministic", t,
        )
    nd, td = _norm_detail(note["detail"]), _norm_detail(t["detail"])
    if ns == "affirmed" and nd and nd != td:
        if not td:
            return _result(
                note, "requires_confirmation",
                f"Transcript mentions {note['value']} but not '{note['detail']}'",
                "deterministic", t,
            )
        return _result(
            note, "potential_conflict",
            f"Note says '{note['detail']}' but transcript says '{t['detail']}'",
            "deterministic", t,
        )
    return _result(
        note, "verified", f"Transcript {ts} '{t['value']}' consistently", "deterministic", t
    )


async def align_and_compare(state: VerifyState) -> VerifyState:
    """Align by meaning (type group + normalised value), compare asserted status."""
    results: list[dict] = []
    pending: list[dict] = []
    for note in state["note_entities"]:
        group = _ALIGN_GROUP.get(note["type"], note["type"])
        intake = _compare_intake(note, state)
        if intake is not None:
            results.append(intake)
            continue
        cands = [
            t for t in state["transcript_entities"]
            if _ALIGN_GROUP.get(t["type"], t["type"]) == group
        ]
        exact = [t for t in cands if t["value"] == note["value"]]
        if exact:
            clear = [r for r in (_decide(note, t) for t in exact) if r is not None]
            if clear:
                # Safety first: any conflict wins over agreement; else first result.
                clear.sort(key=lambda r: r["tier"] != "potential_conflict")
                results.append(clear[0])
            else:
                pending.append({"note": note, "candidates": exact, "slot": len(results)})
                results.append({})
        elif not cands:
            results.append(
                _result(note, "requires_confirmation", "Not found in the transcript", "deterministic", None)
            )
        else:
            # Same type but no matching value: fuzzy alignment / possible mismatch -> LLM.
            pending.append({"note": note, "candidates": cands, "slot": len(results)})
            results.append({})
    return {"results": results, "pending": pending}


_FACT_KEYS = ("type", "value", "detail", "status", "quote")


async def classify(state: VerifyState) -> VerifyState:
    """Resolve pending (ambiguous) facts in ONE batched LLM call, then finalise tiers."""
    results, pending = list(state["results"]), state.get("pending", [])
    if pending:
        payload = [
            {
                "id": i,
                "note_fact": {k: p["note"][k] for k in _FACT_KEYS},
                "transcript_candidates": [
                    {**{k: c[k] for k in _FACT_KEYS}, "index": j}
                    for j, c in enumerate(p["candidates"])
                ],
            }
            for i, p in enumerate(pending)
        ]
        decisions: dict[int, dict] = {}
        for _ in range(2):
            try:
                content = await groq_client.groq_chat(
                    ADJUDICATE_SYSTEM, json.dumps(payload, ensure_ascii=False)
                )
            except Exception:
                break
            data = groq_client.parse_json(content)
            items = data.get("results") if isinstance(data, dict) else None
            if isinstance(items, list):
                for it in items:
                    if (
                        isinstance(it, dict)
                        and isinstance(it.get("id"), int)
                        and it.get("tier") in TIERS
                    ):
                        decisions[it["id"]] = it
                break
        for i, p in enumerate(pending):
            d = decisions.get(i)
            if d is None:
                results[p["slot"]] = _result(
                    p["note"], "requires_confirmation",
                    "Ambiguous; LLM adjudication unavailable - please confirm",
                    "deterministic", None,
                )
                continue
            idx = d.get("aligned_index")
            cands = p["candidates"]
            t = cands[idx] if isinstance(idx, int) and 0 <= idx < len(cands) else None
            results[p["slot"]] = _result(
                p["note"], d["tier"], str(d.get("reason") or "Adjudicated by LLM"), "llm", t
            )
    return {"results": results, "pending": []}


def build_verify_graph():
    g = StateGraph(VerifyState)
    g.add_node("extract_entities", extract_entities)
    g.add_node("align_and_compare", align_and_compare)
    g.add_node("classify", classify)
    g.add_edge(START, "extract_entities")
    g.add_edge("extract_entities", "align_and_compare")
    g.add_edge("align_and_compare", "classify")
    g.add_edge("classify", END)
    return g.compile()


verify_graph = build_verify_graph()
