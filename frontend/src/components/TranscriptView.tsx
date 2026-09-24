import type { RefObject } from "react";

interface Turn {
  speaker: "doctor" | "patient" | null;
  /** [start, labelEnd) is the speaker label ("Doctor:"); [labelEnd, end) is the body. */
  start: number;
  labelEnd: number;
  end: number;
}

/**
 * Split raw_text into speaker turns using offsets only. Every character of raw_text lands in
 * exactly one turn, so highlight offsets stay valid against the untouched raw_text.
 */
function splitTurns(raw: string): Turn[] {
  const labels: { start: number; labelEnd: number; speaker: "doctor" | "patient" }[] = [];
  const re = /(^|\s)(Doctor|Patient)\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[1].length;
    labels.push({
      start,
      labelEnd: m.index + m[0].length,
      speaker: m[2].toLowerCase() as "doctor" | "patient",
    });
  }
  if (labels.length === 0) return [{ speaker: null, start: 0, labelEnd: 0, end: raw.length }];

  const turns: Turn[] = [];
  if (labels[0].start > 0) turns.push({ speaker: null, start: 0, labelEnd: 0, end: labels[0].start });
  labels.forEach((l, i) => {
    turns.push({
      speaker: l.speaker,
      start: l.start,
      labelEnd: l.labelEnd,
      end: i + 1 < labels.length ? labels[i + 1].start : raw.length,
    });
  });
  return turns;
}

interface Props {
  raw: string;
  span: [number, number] | null;
  markClass: string;
  markKey: string | null;
  markRef: RefObject<HTMLElement | null>;
}

export function TranscriptView({ raw, span, markClass, markKey, markRef }: Props) {
  const turns = splitTurns(raw);

  const seg = (a: number, b: number) => {
    if (b <= a) return null;
    if (!span || b <= span[0] || a >= span[1]) return raw.slice(a, b);
    const s = Math.max(a, span[0]);
    const e = Math.min(b, span[1]);
    return (
      <>
        {raw.slice(a, s)}
        <mark
          key={markKey ?? undefined}
          ref={s === span[0] ? markRef : undefined}
          className={`evidence-mark rounded-[2px] px-0.5 text-ink ${markClass}`}
        >
          {raw.slice(s, e)}
        </mark>
        {raw.slice(e, b)}
      </>
    );
  };

  return (
    <div className="space-y-3">
      {turns.map((t) => (
        <div
          key={t.start}
          className={`border-l-2 pl-3 ${
            t.speaker === "doctor"
              ? "border-primary"
              : t.speaker === "patient"
                ? "border-line"
                : "border-transparent"
          }`}
        >
          {t.speaker && (
            <div
              className={`text-xs font-semibold ${
                t.speaker === "doctor" ? "text-primary" : "text-muted"
              }`}
            >
              {seg(t.start, t.labelEnd)}
            </div>
          )}
          <p className="whitespace-pre-line font-serif text-[15px] leading-relaxed text-ink">
            {seg(t.speaker ? t.labelEnd : t.start, t.end)}
          </p>
        </div>
      ))}
    </div>
  );
}
