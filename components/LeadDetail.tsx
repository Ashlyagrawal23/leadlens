"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { LeadActions } from "@/components/LeadActions";
import { MatchPanel } from "@/components/MatchPanel";
import { ScorePanel } from "@/components/ScorePanel";
import { useLeads } from "@/components/useLeads";
import { VoiceCall } from "@/components/VoiceCall";
import { WhatsAppComposer } from "@/components/WhatsAppComposer";
import {
  EmptyState,
  ErrorBanner,
  PriorityBadge,
  ScoreRing,
  fieldClass,
  secondaryButton,
  SkeletonCards,
} from "@/components/ui";
import { postJson } from "@/lib/client";
import { dueLabel, formatWhen, isOverdue } from "@/lib/leads";
import { analyzeResponseSchema, intakeSchema } from "@/lib/schemas";
import { deleteLead, updateLead } from "@/lib/storage";
import type { Lead } from "@/lib/types";

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
        phone: lead.phone,
      });
      const context = [
        ...lead.callNotes.slice(-3).map((note) => `Call: ${note.result.callSummary}`),
        ...lead.matches.map((match) => `Match ${match.propertyId}: ${match.whyItFits}`),
      ].join("\n");
      const result = await postJson("/api/analyze", { ...intake, context }, analyzeResponseSchema);
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
          <Link href="/" className="-my-3 inline-block py-3 text-sm font-semibold text-brand">
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
                <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Suggested response</h2>
                <WhatsAppComposer
                  key={analysis.suggestedResponse}
                  initialText={analysis.suggestedResponse}
                  phoneRaw={lead.phone}
                />
              </div>

              <ScorePanel analysis={analysis} />

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

          <label className="block rounded-2xl border border-line bg-card p-4 text-sm font-semibold shadow-sm">
            Phone
            <input
              className={fieldClass}
              defaultValue={lead.phone}
              key={lead.phone}
              placeholder="98100 12345"
              onBlur={(event) => {
                const phone = event.target.value.trim();
                if (phone !== lead.phone) updateLead(lead.id, { phone });
              }}
            />
            <span className="mt-1 block font-normal text-muted">Used only for the WhatsApp buttons on this page.</span>
          </label>

          <MatchPanel lead={lead} />
          <VoiceCall lead={lead} />
          <ContactTimeline lead={lead} />
          <LeadActions lead={lead} />
        </div>
        <ChatPanel lead={lead} />
      </div>
    </div>
  );
}

function ContactTimeline({ lead }: { lead: Lead }) {
  const events = [
    ...lead.callNotes.map((note) => ({
      id: note.id,
      at: note.contactedAt,
      title: "Call",
      body: note.result.callSummary,
    })),
    ...lead.contactLogs.map((log) => ({
      id: log.id,
      at: log.contactedAt,
      title: log.channel,
      body: log.notes || "No notes",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (events.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <h2 className="font-semibold">Past contacts</h2>
      <ol className="mt-3 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="border-l-2 border-brand pl-3">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              {event.title} · {formatWhen(event.at)}
            </p>
            <p className="text-sm">{event.body}</p>
          </li>
        ))}
      </ol>
    </section>
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
