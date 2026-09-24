import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { TranscriptView } from "./TranscriptView";
import { TierIcon, tierOf } from "./ui";

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

const LANGUAGE_LABELS: Record<string, string> = {
  "tamil-english": "Tamil–English",
  english: "English",
  tamil: "Tamil",
};
const SOURCE_LABELS: Record<string, string> = {
  typed: "Typed",
  synthetic: "Synthetic",
  asr: "Speech recognition",
};

const SECTIONS = [
  { key: "subjective", title: "Subjective", checked: true },
  { key: "objective", title: "Objective", checked: true },
  { key: "assessment", title: "Assessment", checked: false },
  { key: "plan", title: "Plan", checked: false },
] as const;

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
      <span key={n} className={`rounded-[2px] px-0.5 ${tierOf(sp.tier).mark}`}>
        {text.slice(sp.s, sp.e)}
      </span>
    );
    pos = sp.e;
  });
  out.push(text.slice(pos));
  return out;
}

const sentence = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

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
  const attention = sorted.filter((f) => f.tier !== "verified");
  const verifiedList = sorted.filter((f) => f.tier === "verified");

  const renderFlag = (f: FactCheckData) => {
    const t = tierOf(f.tier);
    const isSel = f.id === selectedId;
    const notFound = !resolveSpan(transcript.raw_text, f);
    const isConflict = f.tier === "potential_conflict";
    const isVerified = f.tier === "verified";
    return (
      <li key={f.id}>
        <button
          type="button"
          aria-pressed={isSel}
          onClick={() => setSelectedId(f.id)}
          className={`block w-full rounded-md text-left transition-shadow hover:shadow-sm ${t.card} ${
            isVerified ? "px-3 py-2 hover:bg-paper" : isConflict ? "px-4 py-3.5" : "px-3.5 py-3"
          } ${isSel ? "ring-2 ring-primary ring-offset-1" : ""}`}
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${t.badge} ${
                isVerified ? "px-0" : ""
              }`}
            >
              <TierIcon tier={f.tier} className="h-3.5 w-3.5" />
              {t.label}
            </span>
            <span className="text-xs text-muted">{sentence(f.entity_type)}</span>
          </span>
          <span
            className={`mt-1 block ${
              isConflict
                ? "text-base font-semibold text-ink"
                : isVerified
                  ? "text-sm text-ink"
                  : "text-sm font-medium text-ink"
            }`}
          >
            {f.entity_value}
          </span>
          <span className={`mt-0.5 block text-[13px] ${isVerified ? "text-muted" : "text-ink/80"}`}>
            {f.reason}
          </span>
          {isSel && notFound && (
            <span className="mt-2 block rounded bg-surface/80 px-2 py-1 text-xs font-medium text-ink">
              Not found in the transcript — confirm the source.
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div>
      {/* Tier summary: conflicts dominate, verified stays quiet */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-line bg-surface p-3 sm:p-4">
        {hasResults ? (
          <>
            {counts.potential_conflict > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-md bg-conflict px-4 py-2 text-lg font-semibold text-white">
                <TierIcon tier="potential_conflict" className="h-5 w-5" />
                {counts.potential_conflict} potential conflict
                {counts.potential_conflict === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="text-sm font-medium text-muted">No potential conflicts</span>
            )}
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-confirm">
              <TierIcon tier="requires_confirmation" />
              {counts.requires_confirmation} require
              {counts.requires_confirmation === 1 ? "s" : ""} confirmation
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-verified">
              <TierIcon tier="verified" />
              {counts.verified} verified
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">Verification has not been run yet.</span>
        )}
        <button
          type="button"
          disabled={verifying}
          onClick={onVerify}
          className="btn btn-secondary ml-auto py-1.5"
        >
          {verifying ? "Verifying..." : hasResults ? "Re-run verification" : "Run verification"}
        </button>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        {/* Claims: flags, then the note */}
        <div className="min-w-0 space-y-6">
          {hasResults && (
            <section aria-labelledby="flags-heading">
              <h2 id="flags-heading" className="mb-2 text-sm font-semibold text-ink">
                Needs your attention
              </h2>
              {attention.length === 0 ? (
                <p className="text-sm text-muted">Nothing flagged for confirmation or conflict.</p>
              ) : (
                <ul className="space-y-2">{attention.map(renderFlag)}</ul>
              )}
              {verifiedList.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    aria-expanded={showVerified}
                    onClick={() => setShowVerified((v) => !v)}
                    className="text-sm text-muted underline underline-offset-2 hover:text-ink"
                  >
                    {showVerified ? "Hide" : "Show"} {verifiedList.length} verified
                  </button>
                  {showVerified && <ul className="mt-2 space-y-1">{verifiedList.map(renderFlag)}</ul>}
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="note-heading" className="rounded-lg border border-line bg-surface">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-lg border-b border-line bg-surface px-4 py-3">
              <h2 id="note-heading" className="text-sm font-semibold text-ink">
                Generated note
              </h2>
              <button
                type="button"
                disabled={generatingNote}
                onClick={onRegenerate}
                className="btn btn-secondary py-1 text-xs"
              >
                {generatingNote ? "Regenerating..." : "Regenerate note"}
              </button>
            </div>
            <div className="divide-y divide-line px-4">
              {SECTIONS.map(({ key, title, checked }) => (
                <div key={key} className="py-3">
                  <h3 className="flex items-baseline gap-2 text-[13px] font-semibold text-primary">
                    {title}
                    {!checked && (
                      <span className="text-xs font-normal text-muted">Not part of verification</span>
                    )}
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {checked && hasResults ? markSection(note[key], factChecks) : note[key]}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {hasResults && (
            <div className="rounded-lg border border-line bg-surface p-4">
              {reviewed ? (
                <p className="inline-flex items-center gap-2 text-sm font-medium text-verified">
                  <TierIcon tier="verified" />
                  Marked as reviewed. Nothing was signed or locked.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-muted">
                    Confirms you have seen the flags. This does not sign or lock the note.
                  </p>
                  <button
                    type="button"
                    disabled={reviewing}
                    onClick={onReview}
                    className="btn btn-primary"
                  >
                    {reviewing ? "Saving..." : "Mark as reviewed"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Evidence: the raw transcript, always visible, sticky on desktop */}
        <section
          aria-labelledby="transcript-heading"
          className="flex max-h-[70vh] min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface md:sticky md:top-4 md:max-h-[calc(100vh-2rem)]"
        >
          <div className="shrink-0 border-b border-line px-4 py-3">
            <h2 id="transcript-heading" className="text-sm font-semibold text-ink">
              Raw transcript
            </h2>
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
              <div className="flex gap-1">
                <dt>Language</dt>
                <dd className="font-medium text-ink">
                  {LANGUAGE_LABELS[transcript.language_mix] ?? transcript.language_mix}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>Entered</dt>
                <dd className="font-medium text-ink">
                  {SOURCE_LABELS[transcript.source] ?? transcript.source}
                </dd>
              </div>
            </dl>
            {selected && (
              <p
                className={`mt-2 flex items-center gap-1.5 border-l-4 py-0.5 pl-2 text-xs font-medium ${
                  tierOf(selected.tier).text
                } ${
                  selected.tier === "potential_conflict"
                    ? "border-conflict"
                    : selected.tier === "verified"
                      ? "border-verified"
                      : "border-confirm"
                }`}
              >
                <TierIcon tier={selected.tier} className="h-3.5 w-3.5" />
                {span
                  ? `Evidence for ${selected.entity_value}`
                  : `No passage found for ${selected.entity_value}`}
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <TranscriptView
              raw={transcript.raw_text}
              span={selected && span ? span : null}
              markClass={selected ? tierOf(selected.tier).mark : ""}
              markKey={selected?.id ?? null}
              markRef={markRef}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
