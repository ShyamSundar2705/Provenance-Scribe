import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

import { ReviewPanel } from "../components/ReviewPanel";
import type { FactCheckData, NoteData, TranscriptData } from "../components/ReviewPanel";
import { TranscriptView } from "../components/TranscriptView";
import { AppHeader, StatusBadge, TierIcon, genderLabel } from "../components/ui";

interface ConsultationDetailData {
  id: string;
  doctor_id: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  status: string;
  consent_given: boolean;
  consent_at: string | null;
  created_at: string;
  updated_at: string;
  transcript: TranscriptData | null;
  note: NoteData | null;
  fact_checks: FactCheckData[];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error" }
  | { kind: "loaded"; data: ConsultationDetailData };

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function ConsultationDetail() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [consentChecked, setConsentChecked] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [generatingNote, setGeneratingNote] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const idleMarkRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    api
      .get<ConsultationDetailData>(`/api/v1/consultations/${id}`)
      .then((res) => {
        if (!cancelled) setState({ kind: "loaded", data: res.data });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setState({ kind: "not_found" });
        } else {
          setState({ kind: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  if (state.kind === "not_found" || state.kind === "error") {
    const notFound = state.kind === "not_found";
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className={`font-serif text-xl font-semibold ${notFound ? "text-ink" : "text-conflict"}`}>
            {notFound ? "Consultation not found" : "Failed to load consultation"}
          </p>
          <Link to="/" className="btn btn-secondary mt-5">
            Back to consultations
          </Link>
        </div>
      </div>
    );
  }

  const { data } = state;

  const handleRecordConsent = async () => {
    setRecordingConsent(true);
    setConsentError(null);
    try {
      const res = await api.post<ConsultationDetailData>(
        `/api/v1/consultations/${id}/consent`,
        { consent: true }
      );
      setState({ kind: "loaded", data: res.data });
    } catch {
      setConsentError("Failed to record consent. Please try again.");
    } finally {
      setRecordingConsent(false);
    }
  };

  const handleSaveTranscript = async () => {
    setSavingTranscript(true);
    setCaptureError(null);
    try {
      await api.post(`/api/v1/consultations/${id}/transcript`, {
        raw_text: transcriptText,
        source: "typed",
      });
      const res = await api.get<ConsultationDetailData>(`/api/v1/consultations/${id}`);
      setState({ kind: "loaded", data: res.data });
    } catch {
      setCaptureError("Failed to save transcript. Please try again.");
    } finally {
      setSavingTranscript(false);
    }
  };

  const handleGenerateNote = async () => {
    setGeneratingNote(true);
    setCaptureError(null);
    try {
      await api.post(`/api/v1/consultations/${id}/note`);
      const res = await api.get<ConsultationDetailData>(`/api/v1/consultations/${id}`);
      setState({ kind: "loaded", data: res.data });
    } catch {
      setCaptureError("Failed to generate note. Please try again.");
    } finally {
      setGeneratingNote(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setCaptureError(null);
    try {
      await api.post(`/api/v1/consultations/${id}/verify`);
      const res = await api.get<ConsultationDetailData>(`/api/v1/consultations/${id}`);
      setState({ kind: "loaded", data: res.data });
    } catch {
      setCaptureError("Failed to run verification. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleReview = async () => {
    setReviewing(true);
    setCaptureError(null);
    try {
      const res = await api.post<ConsultationDetailData>(`/api/v1/consultations/${id}/review`);
      setState({ kind: "loaded", data: res.data });
    } catch {
      setCaptureError("Failed to mark as reviewed. Please try again.");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader>
        <Link to="/" className="text-sm font-medium text-muted hover:text-ink">
          Back to consultations
        </Link>
      </AppHeader>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Patient header */}
        <section className="mb-6 rounded-lg border border-line bg-surface px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink">
                {data.patient_name}
              </h1>
              <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">Age</dt>
                  <dd className="font-medium">{data.patient_age} years</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Gender</dt>
                  <dd className="font-medium">{genderLabel(data.patient_gender)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Started</dt>
                  <dd className="font-medium">{shortDate(data.created_at)}</dd>
                </div>
              </dl>
            </div>
            <StatusBadge status={data.status} />
          </div>
          {data.consent_given && data.consent_at && (
            <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-sm text-muted">
              <TierIcon tier="verified" className="h-4 w-4 text-verified" />
              Consent recorded on {new Date(data.consent_at).toLocaleString()}
            </p>
          )}
        </section>

        {data.consent_given ? (
          <>
            {captureError && <p className="error-note mb-4">{captureError}</p>}

            {!data.transcript && (
              <section className="max-w-3xl rounded-lg border border-line bg-surface p-5">
                <label htmlFor="transcript" className="text-base font-semibold text-ink">
                  Paste or type the consultation transcript (Tamil–English)
                </label>
                <p className="mt-1 text-sm text-muted">
                  Start each turn with Doctor: or Patient: to see the conversation turn by turn.
                </p>
                <textarea
                  id="transcript"
                  rows={10}
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="field mt-3 font-serif text-[15px] leading-relaxed"
                />
                <button
                  type="button"
                  disabled={!transcriptText.trim() || savingTranscript}
                  onClick={handleSaveTranscript}
                  className="btn btn-primary mt-3"
                >
                  {savingTranscript ? "Saving..." : "Save transcript"}
                </button>
              </section>
            )}

            {data.transcript && !data.note && (
              <section className="max-w-3xl rounded-lg border border-line bg-surface">
                <div className="border-b border-line px-5 py-3">
                  <h2 className="text-sm font-semibold text-ink">Raw transcript</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    Saved. Generate the note to continue.
                  </p>
                </div>
                <div className="p-5">
                  <TranscriptView
                    raw={data.transcript.raw_text}
                    span={null}
                    markClass=""
                    markKey={null}
                    markRef={idleMarkRef}
                  />
                </div>
                <div className="border-t border-line px-5 py-3">
                  <button
                    type="button"
                    disabled={generatingNote}
                    onClick={handleGenerateNote}
                    className="btn btn-primary"
                  >
                    {generatingNote ? "Generating note..." : "Generate note"}
                  </button>
                </div>
              </section>
            )}

            {data.transcript && data.note && (
              <ReviewPanel
                note={data.note}
                transcript={data.transcript}
                factChecks={data.fact_checks}
                status={data.status}
                verifying={verifying}
                generatingNote={generatingNote}
                reviewing={reviewing}
                onVerify={handleVerify}
                onRegenerate={handleGenerateNote}
                onReview={handleReview}
              />
            )}
          </>
        ) : (
          <section className="max-w-2xl rounded-lg border border-line border-l-4 border-l-primary bg-surface p-5">
            <h2 className="text-base font-semibold text-ink">Patient consent</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              I confirm the patient has given informed verbal consent to record and process
              this consultation for clinical documentation.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              I confirm the above
            </label>
            {consentError && <p className="error-note mt-3">{consentError}</p>}
            <button
              type="button"
              disabled={!consentChecked || recordingConsent}
              onClick={handleRecordConsent}
              className="btn btn-primary mt-4"
            >
              {recordingConsent ? "Recording..." : "Record consent"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
