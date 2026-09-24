import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface FactCheckData {
  id: string;
  entity_type: string;
  entity_value: string;
  tier: string;
  note_quote: string | null;
  transcript_quote: string | null;
  transcript_char_start: number | null;
  transcript_char_end: number | null;
  reason: string;
  method: string;
}

export interface NoteData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  model_used: string;
}

export interface TranscriptData {
  raw_text: string;
  language_mix: string;
  source: string;
}

interface TierStyle {
  label: string;
  icon: string;
  card: string;
  badge: string;
  mark: string;
  order: number;
}

// Colour + icon + text label: never colour alone.
const TIERS: Record<string, TierStyle> = {
  potential_conflict: {
    label: "Potential Conflict",
    icon: "⚠",
    card: "border-red-400 bg-red-50",
    badge: "bg-red-600 text-white",
    mark: "bg-red-200 ring-1 ring-red-500",
    order: 0,
  },
  requires_confirmation: {
    label: "Requires Confirmation",
    icon: "⚑",
    card: "border-amber-300 bg-amber-50",
    badge: "bg-amber-500 text-white",
    mark: "bg-amber-200 ring-1 ring-amber-500",
    order: 1,
  },
  verified: {
    label: "Verified",
    icon: "✓",
    card: "border-slate-200 bg-white",
    badge: "bg-green-100 text-green-800",
    mark: "bg-green-100",
    order: 2,
  },
};

const FALLBACK_TIER: TierStyle = { ...TIERS.requires_confirmation, label: "Unknown", order: 3 };
const tierOf = (t: string): TierStyle => TIERS[t] ?? FALLBACK_TIER;

/** Offsets index into the unmodified raw_text; fall back to searching the quote. */
function resolveSpan(raw: string, f: FactCheckData): [number, number] | null {
  const { transcript_char_start: s, transcript_char_end: e, transcript_quote: q } = f;
  if (s !== null && e !== null && s >= 0 && e > s && e <= raw.length) {
    if (!q || raw.slice(s, e) === q) return [s, e];
  }
  if (q) {
    let i = raw.indexOf(q);
    if (i < 0) i = raw.toLowerCase().indexOf(q.toLowerCase());
    if (i >= 0) return [i, i + q.length];
  }
  return null;
}

/** Best-effort inline marks in one note section; unmatched quotes are silently skipped. */
function markSection(text: string, facts: FactCheckData[]): ReactNode {
  const spans: { s: number; e: number; tier: string }[] = [];
  const lower = text.toLowerCase();
  for (const f of facts) {
    const q = f.note_quote?.trim();
    if (!q) continue;
    const i = lower.indexOf(q.toLowerCase());
    if (i < 0) continue;
    const s = i;
    const e = i + q.length;
    if (spans.some((x) => s < x.e && e > x.s)) continue;
    spans.push({ s, e, tier: f.tier });
  }
  spans.sort((a, b) => a.s - b.s);
  const out: ReactNode[] = [];
  let pos = 0;
  spans.forEach((sp, n) => {
    out.push(text.slice(pos, sp.s));
    out.push(
      <span key={n} className={`rounded px-0.5 ${tierOf(sp.tier).mark}`}>
        {text.slice(sp.s, sp.e)}
      </span>
    );
    pos = sp.e;
  });
  out.push(text.slice(pos));
  return out;
}

interface Props {
  note: NoteData;
  transcript: TranscriptData;
  factChecks: FactCheckData[];
  status: string;
  verifying: boolean;
  generatingNote: boolean;
  reviewing: boolean;
  onVerify: () => void;
  onRegenerate: () => void;
  onReview: () => void;
}

export function ReviewPanel({
  note,
  transcript,
  factChecks,
  status,
  verifying,
  generatingNote,
  reviewing,
  onVerify,
  onRegenerate,
  onReview,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showVerified, setShowVerified] = useState(false);
  const markRef = useRef<HTMLElement | null>(null);

  const sorted = useMemo(
    () => [...factChecks].sort((a, b) => tierOf(a.tier).order - tierOf(b.tier).order),
    [factChecks]
  );
  const counts = useMemo(() => {
    const c = { potential_conflict: 0, requires_confirmation: 0, verified: 0 };
    for (const f of factChecks) if (f.tier in c) c[f.tier as keyof typeof c] += 1;
    return c;
  }, [factChecks]);

  const selected = sorted.find((f) => f.id === selectedId) ?? null;
  const span = selected ? resolveSpan(transcript.raw_text, selected) : null;

  useEffect(() => {
    if (span) markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasResults = factChecks.length > 0;
  const reviewed = status === "reviewed";
  const visible = sorted.filter((f) => f.tier !== "verified" || showVerified);

  const renderTranscript = () => {
    const raw = transcript.raw_text;
    if (!selected || !span) return raw;
    return (
      <>
        {raw.slice(0, span[0])}
        <mark
          ref={markRef}
          className={`rounded px-0.5 text-slate-900 ${tierOf(selected.tier).mark}`}
        >
          {raw.slice(span[0], span[1])}
        </mark>
        {raw.slice(span[1])}
      </>
    );
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
        {hasResults ? (
          <>
            <span
              className={
                counts.potential_conflict > 0
                  ? "rounded-md bg-red-600 px-3 py-1 text-base font-bold text-white"
                  : "text-sm font-medium text-slate-600"
              }
            >
              ⚠ {counts.potential_conflict} Potential Conflict
              {counts.potential_conflict === 1 ? "" : "s"}
            </span>
            <span className="text-sm font-medium text-amber-700">
              ⚑ {counts.requires_confirmation} Require Confirmation
            </span>
            <span className="text-sm text-green-700">✓ {counts.verified} Verified</span>
          </>
        ) : (
          <span className="text-sm text-slate-600">Verification has not been run yet.</span>
        )}
        <button
          type="button"
          disabled={verifying}
          onClick={onVerify}
          className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
        >
          {verifying ? "Verifying..." : hasResults ? "Re-run verification" : "Run verification"}
        </button>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2">
        {/* Note + flags */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-900">Clinical note (SOAP)</h2>
              <button
                type="button"
                disabled={generatingNote}
                onClick={onRegenerate}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 disabled:opacity-40"
              >
                {generatingNote ? "Regenerating..." : "Regenerate note"}
              </button>
            </div>
            {(["subjective", "objective", "assessment", "plan"] as const).map((k) => {
              const checked = k === "subjective" || k === "objective";
              return (
                <div key={k} className="mt-3">
                  <h3 className="text-xs font-semibold uppercase text-slate-500">{k}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                    {checked && hasResults ? markSection(note[k], factChecks) : note[k]}
                  </p>
                </div>
              );
            })}
          </div>

          {hasResults && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-slate-900">Flags</h2>
              <ul className="space-y-2">
                {visible.map((f) => {
                  const t = tierOf(f.tier);
                  const isSel = f.id === selectedId;
                  const notFound = !resolveSpan(transcript.raw_text, f);
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        aria-pressed={isSel}
                        onClick={() => setSelectedId(f.id)}
                        className={`w-full rounded-lg border p-3 text-left ${t.card} ${
                          f.tier === "potential_conflict" ? "border-2" : ""
                        } ${isSel ? "ring-2 ring-slate-900" : ""}`}
                      >
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${t.badge}`}
                        >
                          <span aria-hidden="true">{t.icon}</span> {t.label}
                        </span>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {f.entity_type.replace("_", " ")}: {f.entity_value}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">{f.reason}</p>
                        {isSel && notFound && (
                          <p className="mt-2 rounded bg-white/70 px-2 py-1 text-xs font-medium text-slate-800">
                            Not found in the transcript — confirm the source.
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {counts.verified > 0 && (
                <button
                  type="button"
                  onClick={() => setShowVerified((v) => !v)}
                  className="mt-2 text-xs text-slate-600 underline"
                >
                  {showVerified ? "Hide" : "Show"} {counts.verified} verified
                </button>
              )}
            </div>
          )}

          {hasResults && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              {reviewed ? (
                <p className="text-sm font-medium text-green-800">
                  ✓ Marked as reviewed. Nothing was signed or locked.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-slate-600">
                    Confirms you have seen the flags. This does not sign or lock the note.
                  </p>
                  <button
                    type="button"
                    disabled={reviewing}
                    onClick={onReview}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {reviewing ? "Saving..." : "Mark as reviewed"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Raw transcript: always present, sticky on desktop */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 md:sticky md:top-4">
          <h2 className="text-sm font-medium text-slate-900">Raw transcript</h2>
          <p className="mt-1 text-xs text-slate-500">
            {transcript.language_mix} · {transcript.source}
          </p>
          <pre className="mt-3 max-h-[70vh] overflow-y-auto whitespace-pre-wrap font-sans text-sm text-slate-800">
            {renderTranscript()}
          </pre>
        </div>
      </div>
    </div>
  );
}
