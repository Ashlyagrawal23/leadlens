"use client";

import type { Analysis, ScoreFactor } from "@/lib/types";

const ROWS: Array<{ key: keyof Analysis["scoreBreakdown"]; label: string; max: number }> = [
  { key: "budgetClarity", label: "Budget clarity", max: 25 },
  { key: "timelineUrgency", label: "Timeline urgency", max: 25 },
  { key: "requirementSpecificity", label: "Requirement specificity", max: 20 },
  { key: "engagementSignals", label: "Engagement", max: 20 },
  { key: "redFlagsPenalty", label: "Red flags", max: 20 },
];

export function ScorePanel({ analysis }: { analysis: Analysis }) {
  return (
    <details className="rounded-xl bg-stone-50 px-3 py-2">
      <summary className="cursor-pointer text-sm font-semibold">Why this score?</summary>
      <p className="mt-2 text-xs text-muted">
        Score {analysis.score} is the sum of these factors, clamped between 0 and 100.
        {analysis.hardOverride
          ? ` Priority is ${analysis.priority} because of a hard override, not the band.`
          : " Hot is 70 or above, warm is 40 to 69, cold is under 40."}
      </p>
      {analysis.hardOverride && analysis.hardOverrideReason ? (
        <p className="mt-2 text-sm text-rose-800">{analysis.hardOverrideReason}</p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {ROWS.map((row) => (
          <FactorBar
            key={row.key}
            label={row.label}
            max={row.max}
            factor={analysis.scoreBreakdown[row.key]}
            penalty={row.key === "redFlagsPenalty"}
          />
        ))}
      </ul>
    </details>
  );
}

function FactorBar({
  label,
  max,
  factor,
  penalty,
}: {
  label: string;
  max: number;
  factor: ScoreFactor;
  penalty: boolean;
}) {
  const width = Math.min(100, (Math.abs(factor.points) / max) * 100);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className={penalty && factor.points < 0 ? "font-semibold text-rose-700" : "text-muted"}>
          {factor.points}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-stone-200">
        <div
          className={`h-1.5 rounded-full ${penalty ? "bg-rose-600" : "bg-brand"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className={`mt-1 text-xs ${penalty && factor.points < 0 ? "text-rose-800" : "text-muted"}`}>
        {factor.reason}
      </p>
    </li>
  );
}
