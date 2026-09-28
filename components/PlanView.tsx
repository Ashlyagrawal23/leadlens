"use client";

import Link from "next/link";
import { useState } from "react";
import { useLeads } from "@/components/useLeads";
import { EmptyState, ErrorBanner, primaryButton, PriorityBadge, SkeletonCards } from "@/components/ui";
import { postJson } from "@/lib/client";
import { dueLabel, isOverdue, ruleChannel, ruleQueue, ruleReason, ruleTime, todayLabel } from "@/lib/leads";
import { planResponseSchema } from "@/lib/schemas";
import type { DayPlan, Lead } from "@/lib/types";

export function PlanView() {
  const leads = useLeads();
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!leads) return <SkeletonCards />;

  const queue = ruleQueue(leads);

  async function generate() {
    if (!leads) return;
    setLoading(true);
    setError(null);
    try {
      const result = await postJson("/api/plan", { leads }, planResponseSchema);
      setPlan(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan could not be generated.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-dark">Today&apos;s plan</h1>
          <p className="mt-1 text-muted">{todayLabel()} · work the overdue and hot leads first.</p>
        </div>
        <button type="button" className={primaryButton} disabled={loading || queue.length === 0} onClick={() => void generate()}>
          {loading ? "Planning the day…" : "Generate AI plan"}
        </button>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {queue.length === 0 ? (
        <EmptyState title="No open leads" body="Won and lost leads are left off the plan. Add a lead or reset the demo data." />
      ) : plan ? (
        <section className="space-y-3">
          <div className="rounded-2xl bg-brand px-4 py-3 text-white">
            <p className="text-xs font-semibold tracking-wide uppercase">AI plan · {plan.provider === "gemini" ? "Gemini" : "Groq"}</p>
            <p className="mt-1 text-lg">{plan.focus}</p>
          </div>
          <ol className="space-y-3">
            {plan.items.map((item, index) => {
              const lead = leads.find((entry) => entry.id === item.leadId);
              if (!lead) return null;
              return <PlanCard key={item.leadId} index={index} lead={lead} reason={item.reason} time={item.timeOfDay} channel={item.channel} />;
            })}
          </ol>
          {plan.items.length < queue.length ? (
            <p className="text-sm text-muted">
              {queue.length - plan.items.length} open lead{queue.length - plan.items.length === 1 ? "" : "s"} were not included by the model. They are still on the dashboard.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="space-y-3">
          <p className="text-sm text-muted">
            This order uses follow-up dates and score. Generate an AI plan when you want a reason and a channel for each slot.
          </p>
          <ol className="space-y-3">
            {queue.map((lead, index) => (
              <PlanCard
                key={lead.id}
                index={index}
                lead={lead}
                reason={ruleReason(lead)}
                time={ruleTime(index)}
                channel={ruleChannel(lead)}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function PlanCard({
  index,
  lead,
  reason,
  time,
  channel,
}: {
  index: number;
  lead: Lead;
  reason: string;
  time: string;
  channel: string;
}) {
  return (
    <li className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-2xl text-brand">{index + 1}</span>
        <Link href={`/leads/${lead.id}`} className="text-lg font-semibold hover:underline">
          {lead.name}
        </Link>
        {lead.analysis ? <PriorityBadge priority={lead.analysis.priority} /> : null}
        {isOverdue(lead) ? (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">Overdue</span>
        ) : null}
        <span className="ml-auto text-sm font-semibold text-muted">
          {time} · {channel}
        </span>
      </div>
      <p className="mt-2">{reason}</p>
      <p className="mt-1 text-sm text-muted">
        {lead.location} · {lead.status} · {dueLabel(lead.followUpDueAt)}
        {lead.analysis ? ` · score ${lead.analysis.score}` : ""}
      </p>
    </li>
  );
}
