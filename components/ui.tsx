"use client";

import { useState } from "react";
import type { Priority } from "@/lib/types";

const BADGE: Record<Priority, string> = {
  hot: "bg-rose-100 text-rose-800",
  warm: "bg-amber-100 text-amber-900",
  cold: "bg-slate-200 text-slate-700",
};

const RING: Record<Priority, string> = {
  hot: "#be123c",
  warm: "#b45309",
  cold: "#64748b",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase ${BADGE[priority]}`}>
      {priority}
    </span>
  );
}

export function ScoreRing({ score, priority }: { score: number; priority: Priority }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="26" cy="26" r={radius} stroke="#e7e0d4" strokeWidth="4" fill="none" />
      <circle
        cx="26"
        cy="26"
        r={radius}
        stroke={RING[priority]}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1c1917">
        {score}
      </text>
    </svg>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
      {message}
    </p>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  return (
    <button
      type="button"
      className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-stone-50"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setState("done");
            window.setTimeout(() => setState("idle"), 1500);
          })
          .catch(() => setState("failed"));
      }}
    >
      {state === "done" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </button>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center">
      <h2 className="font-display text-2xl text-brand-dark">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{body}</p>
    </div>
  );
}

export function SkeletonCards() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl bg-stone-200/70" />
      ))}
    </div>
  );
}

export const primaryButton =
  "inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButton =
  "inline-flex items-center justify-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60";

export const fieldClass =
  "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base text-ink shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
