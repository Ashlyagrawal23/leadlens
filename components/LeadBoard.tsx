"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLeads } from "@/components/useLeads";
import {
  EmptyState,
  ErrorBanner,
  PriorityBadge,
  ScoreRing,
  secondaryButton,
  SkeletonCards,
} from "@/components/ui";
import { makeBackup, mergeLeads, parseBackup } from "@/lib/backup";
import { downloadText, localDateStamp } from "@/lib/download";
import { daysSinceTouch, isStale, leadsToCsv, matchesSearch } from "@/lib/insights";
import { dueLabel, isOverdue, visibleLeads, type LeadFilter, type LeadSort } from "@/lib/leads";
import { replaceLeads, resetDemoData } from "@/lib/storage";
import { STATUSES, type LeadStatus, type Priority } from "@/lib/types";

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
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so choosing the same file twice still fires onChange.
    event.target.value = "";
    if (!file || !leads) return;
    try {
      if (file.size > 5_000_000) throw new Error("That file is larger than any LeadLens backup should be.");
      const { leads: incoming, skipped } = parseBackup(await file.text());
      const preview = mergeLeads(leads, incoming, skipped);
      const summary = [
        `${preview.added} new`,
        `${preview.updated} updated`,
        `${preview.unchanged} already up to date`,
        preview.skipped ? `${preview.skipped} unreadable row${preview.skipped === 1 ? "" : "s"} skipped` : "",
        preview.dropped
          ? `${preview.dropped} oldest lead${preview.dropped === 1 ? "" : "s"} dropped to stay under 100`
          : "",
      ]
        .filter(Boolean)
        .join(", ");
      if (preview.added + preview.updated === 0) {
        setNotice({ tone: "ok", text: `Nothing to restore: ${summary}.` });
        return;
      }
      if (!window.confirm(`Restore ${file.name}? ${summary}. Newer edits in this browser are kept.`)) {
        setNotice({ tone: "ok", text: "Restore cancelled. Nothing changed." });
        return;
      }
      replaceLeads(preview.leads);
      setNotice({ tone: "ok", text: `Restored: ${summary}.` });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "The backup could not be read.",
      });
    }
  }

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
        {/* Two per row on phones, one row from sm up. whitespace-nowrap stops "Reset demo data" breaking into three lines. */}
        <div className="grid w-full grid-cols-2 gap-2 whitespace-nowrap sm:flex sm:w-auto">
          <button
            type="button"
            className={secondaryButton}
            disabled={visible.length === 0}
            title="Download the leads shown below as a spreadsheet"
            onClick={() =>
              downloadText(`leadlens-${localDateStamp()}.csv`, leadsToCsv(visible), "text/csv;charset=utf-8")
            }
          >
            Export CSV ({visible.length})
          </button>
          <button
            type="button"
            className={secondaryButton}
            title="Save every lead, note, and chat to a file you can restore later"
            onClick={() =>
              downloadText(`leadlens-backup-${localDateStamp()}.json`, makeBackup(leads), "application/json")
            }
          >
            Back up
          </button>
          <button type="button" className={secondaryButton} onClick={() => fileInput.current?.click()}>
            Restore
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void restore(event)}
          />
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

      {notice?.tone === "error" ? <ErrorBanner message={notice.text} /> : null}
      {notice?.tone === "ok" ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {notice.text}
        </p>
      ) : null}

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
