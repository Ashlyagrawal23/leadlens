"use client";

import Link from "next/link";
import { useState, type DragEvent } from "react";
import { useLeads } from "@/components/useLeads";
import { PriorityBadge, SkeletonCards } from "@/components/ui";
import { formatInr, parseBudgetInr } from "@/lib/inventory";
import { dueLabel, isOverdue } from "@/lib/leads";
import { updateLead } from "@/lib/storage";
import { STATUSES, type Lead, type LeadStatus } from "@/lib/types";

const DRAG_TYPE = "application/x-leadlens-lead";

function columnValue(leads: Lead[]): string | null {
  const total = leads.reduce((sum, lead) => sum + (parseBudgetInr(lead.budget) ?? 0), 0);
  return total > 0 ? formatInr(total) : null;
}

function moveLead(lead: Lead, status: LeadStatus) {
  if (lead.status === status) return;
  updateLead(lead.id, { status });
}

/**
 * Kanban view of the pipeline. Drag a card to another column to change its
 * stage. Every card also has a "Move to" menu, because drag and drop does
 * not work with a keyboard or on most phones.
 */
export function PipelineBoard() {
  const leads = useLeads();
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  if (!leads) return <SkeletonCards />;

  function onDrop(event: DragEvent<HTMLElement>, status: LeadStatus) {
    event.preventDefault();
    setDragOver(null);
    setDraggingId(null);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    const lead = leads?.find((item) => item.id === id);
    if (lead) moveLead(lead, status);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl text-brand-dark">Pipeline</h1>
        <p className="mt-1 text-muted">Drag a card to change its stage, or use the menu on the card.</p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="grid min-w-[60rem] grid-cols-6 gap-2">
          {STATUSES.map((status) => {
            const inColumn = leads
              .filter((lead) => lead.status === status)
              .sort((a, b) => (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1));
            const value = columnValue(inColumn);
            const active = dragOver === status;
            return (
              <section
                key={status}
                aria-label={`${status}, ${inColumn.length} lead${inColumn.length === 1 ? "" : "s"}`}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOver !== status) setDragOver(status);
                }}
                onDragLeave={(event) => {
                  // Leaving for a child card is not leaving the column.
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(null);
                }}
                onDrop={(event) => onDrop(event, status)}
                className={`flex min-h-64 flex-col rounded-2xl border p-2 transition ${
                  active ? "border-brand bg-emerald-50" : "border-line bg-stone-50"
                }`}
              >
                <header className="px-1 pt-1 pb-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{status}</h2>
                    <span className="rounded-full bg-white px-2 text-xs font-semibold tabular-nums ring-1 ring-line">
                      {inColumn.length}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{value ?? "No budgets"}</p>
                </header>

                <ul className="flex flex-1 flex-col gap-2">
                  {inColumn.map((lead) => (
                    <li
                      key={lead.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DRAG_TYPE, lead.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOver(null);
                      }}
                      className={`cursor-grab rounded-xl border border-line bg-card p-3 shadow-sm active:cursor-grabbing ${
                        draggingId === lead.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
                          {lead.name}
                        </Link>
                        {lead.analysis ? (
                          <span className="text-sm font-bold tabular-nums">{lead.analysis.score}</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {lead.location} · {lead.budget}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {lead.analysis ? <PriorityBadge priority={lead.analysis.priority} /> : null}
                        {isOverdue(lead) ? (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                      {status !== "Won" && status !== "Lost" ? (
                        <p className="mt-2 text-xs text-muted">{dueLabel(lead.followUpDueAt)}</p>
                      ) : null}
                      <label className="mt-2 block text-xs text-muted">
                        <span className="sr-only">Move {lead.name} to</span>
                        <select
                          className="w-full rounded-lg border border-line bg-white px-1.5 py-1 text-xs text-ink"
                          value={lead.status}
                          onChange={(event) => moveLead(lead, event.target.value as LeadStatus)}
                        >
                          {STATUSES.map((option) => (
                            <option key={option} value={option}>
                              {option === lead.status ? `In ${option}` : `Move to ${option}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                  {inColumn.length === 0 ? (
                    <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
                      Drop a lead here
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
