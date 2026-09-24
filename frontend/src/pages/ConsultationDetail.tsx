import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";

interface TranscriptData {
  raw_text: string;
  language_mix: string;
  source: string;
}

interface NoteData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  model_used: string;
}

interface FactCheckData {
  id: string;
  entity_type: string;
  entity_value: string;
  tier: string;
  transcript_quote: string | null;
  reason: string;
  method: string;
}

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
  const [captureError, setCaptureError] = useState<string | null>(null);

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-900">Consultation not found</p>
          <Link to="/" className="mt-4 inline-block text-sm text-slate-600 underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-medium text-red-700">Failed to load consultation</p>
          <Link to="/" className="mt-4 inline-block text-sm text-slate-600 underline">
            Back to dashboard
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

  const rawTranscriptPanel = data.transcript && (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-900">Raw transcript</h2>
      <p className="mt-1 text-xs text-slate-500">
        {data.transcript.language_mix} · {data.transcript.source}
      </p>
      <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-slate-800">
        {data.transcript.raw_text}
      </pre>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link to="/" className="text-sm text-slate-600 underline">
          ← Back to dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="mb-4 text-xl font-semibold text-slate-900">{data.patient_name}</h1>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Age</dt>
              <dd className="font-medium text-slate-900">{data.patient_age}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Gender</dt>
              <dd className="font-medium capitalize text-slate-900">{data.patient_gender}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium uppercase text-slate-900">{data.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd className="font-medium text-slate-900">
                {new Date(data.created_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        {data.consent_given ? (
          <>
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Consent recorded on {new Date(data.consent_at!).toLocaleString()}
            </div>
            <div className="mt-6">
              {captureError && <p className="mb-2 text-sm text-red-700">{captureError}</p>}
              {!data.transcript ? (
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <label className="text-sm font-medium text-slate-900" htmlFor="transcript">
                    Paste or type the consultation transcript (Tamil–English)
                  </label>
                  <textarea
                    id="transcript"
                    rows={10}
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!transcriptText.trim() || savingTranscript}
                    onClick={handleSaveTranscript}
                    className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingTranscript ? "Saving..." : "Save transcript"}
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    {rawTranscriptPanel}
                    {!data.note && (
                      <button
                        type="button"
                        disabled={generatingNote}
                        onClick={handleGenerateNote}
                        className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {generatingNote ? "Generating note..." : "Generate note"}
                      </button>
                    )}
                  </div>
                  {data.note && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <h2 className="text-sm font-medium text-slate-900">Clinical note (SOAP)</h2>
                      {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
                        <div key={k} className="mt-3">
                          <h3 className="text-xs font-semibold uppercase text-slate-500">{k}</h3>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                            {data.note![k]}
                          </p>
                        </div>
                      ))}
                      <button
                        type="button"
                        disabled={generatingNote}
                        onClick={handleGenerateNote}
                        className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
                      >
                        {generatingNote ? "Regenerating..." : "Regenerate note"}
                      </button>
                      {/* TEMPORARY debug view for C2/C3 - replaced by the C4 review UI. */}
                      <div className="mt-4 border-t border-slate-200 pt-3">
                        <button
                          type="button"
                          disabled={verifying}
                          onClick={handleVerify}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
                        >
                          {verifying ? "Verifying..." : "Run verification"}
                        </button>
                        <ul className="mt-2 text-xs">
                          {data.fact_checks.map((f) => (
                            <li key={f.id}>
                              {f.entity_type}: {f.entity_value} - {f.tier} ({f.method}) -{" "}
                              {f.reason}
                              {f.transcript_quote && ` - transcript: "${f.transcript_quote}"`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-medium text-slate-900">Patient consent</h2>
            <p className="mt-2 text-sm text-slate-600">
              I confirm the patient has given informed verbal consent to record and process
              this consultation for clinical documentation.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              I confirm the above
            </label>
            {consentError && <p className="mt-2 text-sm text-red-700">{consentError}</p>}
            <button
              type="button"
              disabled={!consentChecked || recordingConsent}
              onClick={handleRecordConsent}
              className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {recordingConsent ? "Recording..." : "Record consent"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
