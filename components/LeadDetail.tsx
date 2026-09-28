"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { LeadActions } from "@/components/LeadActions";
import { useLeads } from "@/components/useLeads";
import {
  CopyButton,
  EmptyState,
  ErrorBanner,
  PriorityBadge,
  ScoreRing,
  secondaryButton,
  SkeletonCards,
} from "@/components/ui";
import { postJson } from "@/lib/client";
import { dueLabel, isOverdue } from "@/lib/leads";
import { analyzeResponseSchema, intakeSchema } from "@/lib/schemas";
import { deleteLead, updateLead } from "@/lib/storage";

export function LeadDetail({ id }: { id: string }) {
  const leads = useLeads();
  const lead = leads?.find((item) => item.id === id) ?? null;

  if (!leads) return <SkeletonCards />;
  if (!lead) {
    return (
      <EmptyState title="Lead not found" body="It may have been deleted in this browser." />
    );
  }

  return <LeadScreen key={lead.id} id={id} />;
}

function LeadScreen({ id }: { id: string }) {
  const router = useRouter();
  const leads = useLeads();
  const lead = leads?.find((item) => item.id === id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!lead) return null;

  const analysis = lead.analysis;
  const overdue = isOverdue(lead);

  async function reanalyze() {
    if (!lead) return;
    setLoading(true);
    setError(null);
    try {
      const intake = intakeSchema.parse({
        name: lead.name,
        location: lead.location,
        propertyRequirement: lead.propertyRequirement,
        budget: lead.budget,
        timeline: lead.timeline,
        message: lead.message,
      });
      const result = await postJson("/api/analyze", intake, analyzeResponseSchema);
      updateLead(lead.id, { analysis: result.analysis, analyzedBy: result.provider });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Re-analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm font-semibold text-brand">
            All leads
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-4xl text-brand-dark">{lead.name}</h1>
            {analysis ? <PriorityBadge priority={analysis.priority} /> : null}
            {analysis?.urgencyFlag ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Urgent</span>
            ) : null}
            {overdue ? (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                Overdue
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-muted">
            {lead.location} · {lead.budget} · {lead.timeline} · {lead.status} · {dueLabel(lead.followUpDueAt)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {lead.analyzedBy === "seed"
              ? "Demo analysis. Re-analyze to call the model."
              : lead.analyzedBy
                ? `Analyzed with ${lead.analyzedBy === "gemini" ? "Gemini" : "Groq"}.`
                : "Not analyzed yet."}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={secondaryButton} disabled={loading} onClick={() => void reanalyze()}>
            {loading ? "Re-analyzing…" : "Re-analyze"}
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              const ok = window.confirm(`Delete ${lead.name}? This only removes the lead from this browser.`);
              if (!ok) return;
              deleteLead(lead.id);
              router.push("/");
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {analysis ? (
            <article className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">Intent</p>
                  <p className="text-lg font-semibold">{analysis.intent}</p>
                  <p className="mt-2 text-ink">{analysis.summary}</p>
                </div>
                <ScoreRing score={analysis.score} priority={analysis.priority} />
              </div>

              {analysis.urgencyFlag ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{analysis.urgencyReason}</p>
              ) : (
                <p className="text-sm text-muted">{analysis.urgencyReason}</p>
              )}

              <div className="rounded-xl border-l-4 border-brand bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold tracking-wide text-brand-dark uppercase">Next action</p>
                <p className="mt-1 font-medium">{analysis.nextAction}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <BulletList title="Key requirements" items={analysis.keyRequirements} empty="None mentioned." />
                <BulletList title="Objections" items={analysis.objections} empty="None mentioned." />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Suggested response</h2>
                  <CopyButton text={analysis.suggestedResponse} />
                </div>
                <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm whitespace-pre-wrap">{analysis.suggestedResponse}</p>
              </div>

              <div>
                <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Why this score</h2>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {analysis.scoreReasoning.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">Customer message</summary>
                <p className="mt-2 whitespace-pre-wrap text-muted">{lead.message}</p>
                <p className="mt-2 text-muted">
                  Requirement: {lead.propertyRequirement}
                </p>
              </details>
            </article>
          ) : (
            <EmptyState title="No analysis yet" body="Use Re-analyze to score this lead." />
          )}

          <LeadActions lead={lead} />
        </div>
        <ChatPanel lead={lead} />
      </div>
    </div>
  );
}

function BulletList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
