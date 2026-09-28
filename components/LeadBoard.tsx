"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLeads } from "@/components/useLeads";
import { EmptyState, PriorityBadge, ScoreRing, secondaryButton, SkeletonCards } from "@/components/ui";
import { daysSinceTouch, isStale, leadsToCsv, matchesSearch } from "@/lib/insights";
import { dueLabel, isOverdue, visibleLeads, type LeadFilter, type LeadSort } from "@/lib/leads";
import { resetDemoData } from "@/lib/storage";
import { STATUSES, type Lead, type LeadStatus, type Priority } from "@/lib/types";

function downloadCsv(leads: Lead[]) {
  // The BOM makes Excel read ₹ and other non-ASCII text as UTF-8.
  const blob = new Blob(["\uFEFF", leadsToCsv(leads)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // en-CA formats as YYYY-MM-DD in the local time zone. toISOString() is UTC and names the file yesterday after midnight IST.
  link.download = `leadlens-${new Date().toLocaleDateString("en-CA")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const FILTERS: Array<{ id: LeadFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "hot", label: "Hot" },
  { id: "warm", label: "Warm" },
  { id: "cold", label: "Cold" },
];

export function LeadBoard() {
  const leads = useLeads();
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [sort, setSort] = useState<LeadSort>("score");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");

  const visible = useMemo(
    () =>
      leads
        ? visibleLeads(leads, filter, sort).filter(
            (lead) => (status === "all" || lead.status === status) && matchesSearch(lead, query),
          )
        : [],
    [leads, filter, sort, status, query],
  );

  if (!leads) return <SkeletonCards />;

  const hotCount = leads.filter((lead) => lead.analysis?.priority === "hot").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-dark">Inbox</h1>
          <p className="mt-1 text-muted">
            {leads.length} leads · {hotCount} hot
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={secondaryButton}
            disabled={visible.length === 0}
            title="Download the leads shown below as a spreadsheet"
            onClick={() => downloadCsv(visible)}
          >
            Export CSV ({visible.length})
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              const ok = window.confirm("Replace every lead in this browser with the 6 demo leads?");
              if (ok) resetDemoData();
            }}
          >
            Reset demo data
          </button>
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, city, phone, requirement…"
        aria-label="Search leads"
        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-ink shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by priority">
          {FILTERS.map((item) => {
            const count =
              item.id === "all"
                ? leads.length
                : leads.filter((lead) => lead.analysis?.priority === item.id).length;
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  selected ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line"
                }`}
              >
                {item.label} {count}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-muted">
            Stage
            <select
              className="ml-2 rounded-lg border border-line bg-white px-2 py-1.5 text-ink"
              value={status}
              onChange={(event) => setStatus(event.target.value as LeadStatus | "all")}
            >
              <option value="all">All stages</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted">
            Sort
            <select
              className="ml-2 rounded-lg border border-line bg-white px-2 py-1.5 text-ink"
              value={sort}
              onChange={(event) => setSort(event.target.value as LeadSort)}
            >
              <option value="score">Score</option>
              <option value="newest">Newest</option>
              <option value="followup">Follow-up due</option>
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={query ? `No leads match “${query}”` : "Nothing in this filter"}
          body="Try another search, priority, or stage, add a lead, or reset the demo data."
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((lead) => {
            const priority = lead.analysis?.priority;
            const overdue = isOverdue(lead);
            const stale = !overdue && isStale(lead);
            return (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="block rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{lead.name}</h2>
                        {priority ? <PriorityBadge priority={priority as Priority} /> : null}
                        {lead.analysis?.urgencyFlag ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                            Urgent
                          </span>
                        ) : null}
                        {overdue ? (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                            Overdue
                          </span>
                        ) : null}
                        {stale ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                            {daysSinceTouch(lead)}d silent
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {lead.location} · {lead.budget}
                      </p>
                      <p className="mt-2 line-clamp-2 text-ink">
                        {lead.analysis?.summary ?? "Not analyzed yet."}
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        {lead.status} · {lead.timeline} · Follow-up due: {dueLabel(lead.followUpDueAt)}
                      </p>
                    </div>
                    {lead.analysis && priority ? (
                      <ScoreRing score={lead.analysis.score} priority={priority} />
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
