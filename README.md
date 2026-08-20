# Provenance-Aware Clinical Documentation Assistant

A clinical documentation assistant for **Tamil–English code-mixed** outpatient
consultations. It generates a structured note and — this is the point — **verifies a
closed set of safety-critical facts against what was actually said in the consultation**,
highlighting exactly which parts a clinician should confirm before signing.

> **Working repo name:** `provenance-scribe` · **Status:** under active development,
> built one module at a time. The doctor-facing application shell is complete and verified;
> the verification layer (the core research contribution) is the next phase. See
> [Project status](#project-status) for an honest module-by-module breakdown.

---

## Why this exists

Modern AI scribes optimise for **speed of documentation**, not **verification of content**.
Clinicians are nominally responsible for reviewing every generated note, but at real
outpatient volumes (60–100 patients a day) careful line-by-line review does not happen —
a polished draft gets signed without close reading. Subtle errors (a fabricated symptom, a
reversed negation, a wrong dose) pass through unnoticed.

In the Indian setting this is compounded by Tamil–English code-mixed consultations that
incumbent tools aren't built for, high outpatient workloads, and cost barriers that put
enterprise scribes out of reach.

The gap this project addresses: a verification layer focused on a **narrow, fixed set of
safety-critical facts**, rather than an attempt to verify the entire medical reasoning process.

## The idea

Note generation is the commodity; the **verification layer is the contribution.** The
organising principle is **provenance** — every safety-critical fact in the note can be
traced to who said it, or is explicitly owned by the clinician when it cannot.

Each in-scope fact in a generated note is classified into one of three states:

- **Verified** — explicitly supported by the transcript.
- **Requires Clinician Confirmation** — appears in the note but was not stated in the
  consultation. *Not* labelled an error — the system asks the clinician to confirm the
  source (prior history, judgment, external records).
- **Potential Safety Conflict** — the note contradicts something explicit in the transcript
  (allergy mismatch, wrong dose, **negation reversal**). Highest priority.

The defensible novelty is **cross-lingual, code-mixed assertion verification** — resolving
whether a fact written in English was *affirmed, denied, or never stated* in Tamil–English
speech. Example: the patient says *"ila doctor"* (Tamil for "no") when asked about a cough,
but the note lists cough as a present symptom. Naïve keyword matching sees "cough" in both
and marks it verified; correct assertion-level handling flags a negation reversal. Catching
this across a Tamil→English boundary is where established English rule-based methods fail.

> **Framing note:** this system **verifies a predefined set of safety-critical facts against
> the transcript and highlights unsupported or conflicting information for clinician review.**
> It is not a "hallucination detector," and it does not touch clinical reasoning.

---

## Project status

Built strictly module by module. This table is the source of truth for what actually exists.

| # | Module | State |
|---|--------|-------|
| S1 | Doctor authentication (JWT, bcrypt, protected routes) | ✅ **Built & verified** |
| S2 | Dashboard + patient intake, Postgres in Docker | ✅ **Built & verified** |
| S3 | Patient consent to record | ⏳ Planned (next) |
| C0 | Consultation capture / text-in → builds the transcript | ⏳ Planned |
| C1 | Note generation (Tanglish → clean note) | ⏳ Planned |
| C2 | Safety-entity extraction | ⏳ Planned |
| C3 | Assertion comparison + three-tier classification | ⏳ Planned — **the core contribution** |
| C4 | Clinician review UI (provenance highlighting) | ⏳ Planned |
| E1 | Evaluation harness (recall / precision on planted-error set) | ⏳ Planned |
| F1 | Live ASR adapter (reused from prior work) | ⏳ Planned — reused, not a contribution |

**In plain terms:** you can currently register a doctor, log in, and create/list
consultations with patient details, backed by Postgres. The note-generation and
verification pipeline — the research core — has **not been implemented yet**. Nothing here
is deployed, and no evaluation results exist yet.

---

## Architecture

The design's spine is a **TEXT BOUNDARY**: two separate pipelines meeting at one contract.

```
LIVE / DEMO:  mic → [ASR: reused, pluggable, out of scope] ─┐
                                                            ├─→ Transcript ─→ [Verification pipeline] ─→ 3-tier flags ─→ Review UI
DEV / EVAL:   typed / synthetic transcript ─────────────────┘
                                                    ▲
                                               TEXT BOUNDARY
```

- The **verification pipeline is the contribution** and runs on text — it can be exercised
  with typed/synthetic transcripts and **no audio at all** (that's the evaluation path).
- The **ASR is reused from prior work, pluggable, and explicitly out of scope** — not
  rebuilt, not evaluated. It sits behind an adapter; the verification side depends only on a
  `Transcript` object, never on audio.
- The **raw Tanglish transcript is preserved as the provenance anchor** — every verified
  fact traces back to it. The clean note and the raw transcript are both kept.

---

## Tech stack

- **Backend / orchestration:** FastAPI + LangGraph (verification implemented as graph nodes)
- **LLM:** Groq-hosted (called via HTTPS REST directly)
- **Frontend:** React + TypeScript + Vite + Tailwind
- **Database:** PostgreSQL (async SQLAlchemy) — SQLite-compatible via a single URL change
- **Auth:** JWT (HS256) + bcrypt

---

## Getting started (local development)

**Prerequisites:** Docker, Python 3.11+, Node.js 18+.

```bash
# 1. Configure environment (never commit the real .env)
cp .env.example .env
#    then fill in JWT_SECRET and the Postgres credentials in .env

# 2. Start Postgres (containerised)
docker compose up -d

# 3. Backend — tables are created on startup
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# 4. Frontend
cd ../frontend
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

**Secrets hygiene:** `.env`, the local database, and `node_modules`/`.venv` are gitignored.
`docker-compose.yml` reads the Postgres password from `.env` via `${POSTGRES_PASSWORD}` —
no credential literals are committed. Keep it that way.

To reset the database to a clean slate: `docker compose down -v` (drops the volume), then
`docker compose up -d`.

---

## Repository structure

```
backend/
  app/
    core/     # config, async DB layer, auth (JWT + bcrypt)
    models/   # SQLAlchemy models (Doctor, AuditLog, ConsultationSession)
    schemas/  # Pydantic request/response models
    api/      # routers (auth, consultations)
    main.py
frontend/
  src/        # React app (auth store, axios client, pages, routing)
docker-compose.yml   # Postgres service
prompts/             # per-module build specs (the plan for each module)
CLAUDE.md            # standing context / conventions for the codebase
```

---

## Safety, scope & ethics

- **Human-in-the-loop, assistive not autonomous.** The clinician is always the final
  decision-maker. The system highlights; it never auto-commits or decides. This framing is
  deliberate and aligns with CDSCO Software-as-a-Medical-Device and India's SAHI
  considerations.
- **The verifier operates only on a closed schema** of extractable safety-critical facts
  (medication name/dose/frequency/duration, allergies, stated diagnoses, chief complaint,
  age, gender, pregnancy status, vitals, stated numbers, negations). It **stays structurally
  out of the Assessment and Plan** narrative — clinical reasoning remains entirely under
  clinician control.
- **Data:** consultation audio is never persisted. Development and evaluation use
  typed/synthetic and role-played transcripts; **real de-identified clinical data is out of
  scope** (ethics approval and consent) and noted as future work.
- **Not deployed.** EHR / ABDM-ABHA integration and any production deployment are future work.

---

## Roadmap

Nearest next steps: S3 (consent gate) → C0 (text-in) → C1 (note generation) → C2/C3 (the
verification core) → C4 (review UI) → E1 (evaluation). The reused ASR front-end (F1) is
wired in last, as a demo capability rather than a graded contribution.

---

## Author & context

Final-year B.Tech (Information Technology) project.
Shyam Sundar — GitHub [@ShyamSundar2705](https://github.com/ShyamSundar2705) ·
[shyamsundar.is-a.dev](https://shyamsundar.is-a.dev)

## License

To be decided — treat as all rights reserved until a license is added.
