"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLeads } from "@/components/useLeads";
import { EmptyState, PriorityBadge, SkeletonCards } from "@/components/ui";
import { buildInsights, daysSinceTouch, PRIORITY_ORDER, STALE_AFTER_DAYS } from "@/lib/insights";
import { formatInr } from "@/lib/inventory";

// Same hues as PriorityBadge and ScoreRing, so a colour means the same thing on every page.
const PRIORITY_FILL: Record<(typeof PRIORITY_ORDER)[number], string> = {
  hot: "#be123c",
  warm: "#b45309",
  cold: "#64748b",
  unscored: "#d6d3d1",
};

const PRIORITY_LABEL: Record<(typeof PRIORITY_ORDER)[number], string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  unscored: "Not scored",
};

function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function InsightsView() {
  const leads = useLeads();
  const insights = useMemo(() => (leads ? buildInsights(leads) : null), [leads]);

  if (!leads || !insights) return <SkeletonCards />;
  if (insights.total === 0) {
    return (
      <EmptyState title="No leads yet" body="Add a lead or reset the demo data to see pipeline numbers." />
    );
  }

  const funnelMax = Math.max(1, ...insights.byStatus.map((row) => row.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-brand-dark">Insights</h1>
        <p className="mt-1 text-muted">
          Pipeline health for the {insights.total} leads in this browser. No AI calls.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Open leads" value={String(insights.open)} note={`${insights.total} total`} />
        <StatTile
          label="Open pipeline"
          value={insights.openPipelineInr > 0 ? formatInr(insights.openPipelineInr) : "—"}
          note={
            insights.openWithoutBudget > 0
              ? `Sum of stated budgets · ${insights.openWithoutBudget} without a number`
              : "Sum of stated budgets"
          }
        />
        <StatTile
          label="Win rate"
          value={insights.winRate === null ? "—" : `${Math.round(insights.winRate * 100)}%`}
          note={`${insights.won} won · ${insights.lost} lost`}
        />
        <StatTile
          label="Overdue follow-ups"
          value={String(insights.overdue)}
          note={insights.overdue > 0 ? "Work these first" : "All caught up"}
        />
        <StatTile
          label="Median first reply"
          value={formatHours(insights.medianHoursToFirstContact)}
          note={`${insights.contactedCount} leads contacted`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Pipeline by stage</h2>
          <p className="text-sm text-muted">
            Lead count per status, with the average AI score in that stage.
          </p>
          <ul className="mt-4 space-y-2">
            {insights.byStatus.map((row) => (
              <li
                key={row.status}
                className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3 text-sm"
                title={`${row.status}: ${row.count} lead${row.count === 1 ? "" : "s"}${
                  row.avgScore === null ? "" : `, average score ${row.avgScore}`
                }`}
              >
                <span className="font-medium">{row.status}</span>
                <span className="h-5 rounded bg-stone-100">
                  {row.count > 0 ? (
                    <span
                      className="block h-full rounded bg-brand"
                      style={{ width: `${(row.count / funnelMax) * 100}%` }}
                    />
                  ) : null}
                </span>
                <span className="text-right tabular-nums">
                  {row.count}
                  <span className="text-muted">{row.avgScore === null ? "" : ` · avg ${row.avgScore}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Priority mix</h2>
          <p className="text-sm text-muted">
            Average score {insights.avgScore ?? "—"}. Hot is 70 and up, warm 40–69, cold under 40.
          </p>
          <div className="mt-4 flex h-6 gap-0.5 overflow-hidden rounded" role="img" aria-label="Priority mix">
            {PRIORITY_ORDER.map((key) =>
              insights.byPriority[key] > 0 ? (
                <span
                  key={key}
                  title={`${PRIORITY_LABEL[key]}: ${insights.byPriority[key]}`}
                  style={{ flexGrow: insights.byPriority[key], background: PRIORITY_FILL[key] }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {PRIORITY_ORDER.map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: PRIORITY_FILL[key] }}
                />
                {PRIORITY_LABEL[key]}{" "}
                <span className="tabular-nums text-muted">{insights.byPriority[key]}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-6 text-sm font-semibold">Top cities</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-muted uppercase">
              <tr>
                <th className="py-1 font-semibold">City</th>
                <th className="py-1 text-right font-semibold">Leads</th>
                <th className="py-1 text-right font-semibold">Hot</th>
              </tr>
            </thead>
            <tbody>
              {insights.topCities.map((row) => (
                <tr key={row.city} className="border-t border-line">
                  <td className="py-1.5">{row.city}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.hot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Going cold</h2>
        <p className="text-sm text-muted">
          Open leads nobody has touched in {STALE_AFTER_DAYS}+ days, longest silence first.
        </p>
        {insights.stale.length === 0 ? (
          <p className="mt-3 text-sm">Every open lead was contacted in the last {STALE_AFTER_DAYS} days.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {insights.stale.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 py-2 hover:bg-stone-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{lead.name}</span>
                    {lead.analysis ? <PriorityBadge priority={lead.analysis.priority} /> : null}
                    <span className="truncate text-sm text-muted">{lead.status}</span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">
                    {daysSinceTouch(lead)} days silent
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </div>
  );
}
