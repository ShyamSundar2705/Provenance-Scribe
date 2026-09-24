import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type TierKey = "potential_conflict" | "requires_confirmation" | "verified";

export interface TierMeta {
  label: string;
  order: number;
  /** solid badge */
  badge: string;
  /** left-rule card treatment */
  card: string;
  /** text colour */
  text: string;
  /** inline highlight (note + transcript) */
  mark: string;
}

// Sentence-case labels; colour + icon + text, never colour alone.
export const TIERS: Record<TierKey, TierMeta> = {
  potential_conflict: {
    label: "Potential conflict",
    order: 0,
    badge: "bg-conflict text-white",
    card: "border-l-4 border-conflict bg-conflict-tint",
    text: "text-conflict",
    mark: "bg-conflict-mark border-b-2 border-conflict",
  },
  requires_confirmation: {
    label: "Requires confirmation",
    order: 1,
    badge: "bg-confirm-tint text-confirm ring-1 ring-inset ring-confirm/40",
    card: "border-l-4 border-confirm bg-confirm-tint",
    text: "text-confirm",
    mark: "bg-confirm-mark border-b-2 border-confirm",
  },
  verified: {
    label: "Verified",
    order: 2,
    badge: "text-verified",
    card: "border-l-2 border-verified/50 bg-surface",
    text: "text-verified",
    mark: "border-b border-verified/70 bg-verified-tint",
  },
};

const UNKNOWN_TIER: TierMeta = { ...TIERS.requires_confirmation, label: "Unrecognised result" };

export const tierOf = (t: string): TierMeta => TIERS[t as TierKey] ?? UNKNOWN_TIER;

export function TierIcon({ tier, className = "h-4 w-4" }: { tier: string; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (tier === "potential_conflict") {
    return (
      <svg {...common}>
        <path d="M10 2.5 18 16.5H2L10 2.5Z" />
        <path d="M10 8v4M10 14.2v.1" />
      </svg>
    );
  }
  if (tier === "verified") {
    return (
      <svg {...common}>
        <path d="M4 10.5 8.2 14.5 16 5.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 17.5V3M5 4h9l-2 3.5 2 3.5H5" />
    </svg>
  );
}

const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  transcribed: "Transcript saved",
  noted: "Note generated",
  checked: "Verification run",
  reviewed: "Reviewed",
};

export function StatusBadge({ status }: { status: string }) {
  const reviewed = status === "reviewed";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        reviewed ? "bg-verified-tint text-verified" : "bg-paper text-muted ring-1 ring-inset ring-line"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif text-xl font-semibold tracking-tight ${className}`}>
      Provenance Scribe
    </span>
  );
}

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="text-primary">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-4">{children}</div>
      </div>
    </header>
  );
}

export const genderLabel = (g: string) => g.charAt(0).toUpperCase() + g.slice(1);
