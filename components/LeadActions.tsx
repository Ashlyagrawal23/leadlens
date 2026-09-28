"use client";

import { useState } from "react";
import { CopyButton, ErrorBanner, fieldClass, primaryButton, secondaryButton } from "@/components/ui";
import { postJson } from "@/lib/client";
import { addDaysFromNow, followUpOffsetDays, formatWhen, newId } from "@/lib/leads";
import { briefResponseSchema, followUpResponseSchema } from "@/lib/schemas";
import { updateLead } from "@/lib/storage";
import {
  CHANNELS,
  FOLLOW_UP_CHANNELS,
  STATUSES,
  type CallBrief,
  type Channel,
  type FollowUpChannel,
  type Lead,
  type LeadStatus,
} from "@/lib/types";

export function LeadActions({ lead }: { lead: Lead }) {
  const [brief, setBrief] = useState<CallBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const [channel, setChannel] = useState<Channel>("call");
  const [notes, setNotes] = useState("");
  const suggestedDays = followUpOffsetDays(lead.timeline, lead.analysis?.urgencyFlag ?? false);
  const [dueChoice, setDueChoice] = useState<"suggested" | "1" | "3" | "7">("suggested");
  const [logged, setLogged] = useState(false);

  const [draftChannel, setDraftChannel] = useState<FollowUpChannel>("whatsapp");
  const [draft, setDraft] = useState<{ subject: string; message: string } | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function loadBrief() {
    setBriefLoading(true);
    setBriefError(null);
    try {
      const result = await postJson("/api/brief", { lead }, briefResponseSchema);
      setBrief(result);
    } catch (error) {
      setBriefError(error instanceof Error ? error.message : "The brief could not be prepared.");
    } finally {
      setBriefLoading(false);
    }
  }

  function logContact() {
    const now = new Date().toISOString();
    const nextStatus: LeadStatus = lead.status === "New" ? "Contacted" : lead.status;
    updateLead(lead.id, {
      status: nextStatus,
      lastContactedAt: now,
      followUpDueAt: addDaysFromNow(dueChoice === "suggested" ? suggestedDays : Number(dueChoice)),
      contactLogs: [
        ...lead.contactLogs,
        { id: newId(), channel, notes: notes.trim(), contactedAt: now },
      ],
    });
    setNotes("");
    setLogged(true);
  }

  async function draftFollowUp() {
    setDraftLoading(true);
    setDraftError(null);
    try {
      const result = await postJson(
        "/api/followup",
        { lead, channel: draftChannel },
        followUpResponseSchema,
      );
      setDraft({ subject: result.subject ?? "", message: result.message });
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "The follow-up could not be drafted.");
    } finally {
      setDraftLoading(false);
    }
  }

  const copyText = draft
    ? draftChannel === "email"
      ? `Subject: ${draft.subject}\n\n${draft.message}`
      : draft.message
    : "";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Call prep brief</h2>
          <button type="button" className={secondaryButton} onClick={() => void loadBrief()} disabled={briefLoading}>
            {briefLoading ? "Preparing…" : brief ? "Refresh brief" : "30-second brief"}
          </button>
        </div>
        {briefError ? (
          <div className="mt-3">
            <ErrorBanner message={briefError} />
          </div>
        ) : null}
        {brief ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              <span className="font-semibold">Opener. </span>
              {brief.opener}
            </p>
            <div>
              <p className="font-semibold">Talking points</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {brief.talkingPoints.map((point, index) => (
                  <li key={`${index}-${point}`}>{point}</li>
                ))}
              </ul>
            </div>
            {brief.objections.length > 0 ? (
              <div>
                <p className="font-semibold">If they push back</p>
                <ul className="mt-1 space-y-2">
                  {brief.objections.map((item) => (
                    <li key={item.objection}>
                      <span className="font-medium">{item.objection}</span>
                      <span className="text-muted"> — {item.rebuttal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="rounded-xl bg-emerald-50 px-3 py-2">
              <span className="font-semibold">Ask. </span>
              {brief.ask}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Opener, three points, likely objections, and the close.</p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <h2 className="font-semibold">Pipeline</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.map((status) => {
            const selected = lead.status === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={selected}
                onClick={() => updateLead(lead.id, { status })}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  selected ? "bg-brand text-white" : "bg-stone-100 text-ink hover:bg-stone-200"
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">
          {lead.lastContactedAt
            ? `Last contact ${formatWhen(lead.lastContactedAt)}`
            : "No contact logged yet."}
        </p>
        {lead.contactLogs.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {lead.contactLogs.slice(-3).map((entry) => (
              <li key={entry.id} className="text-muted">
                <span className="font-medium text-ink capitalize">{entry.channel}</span>
                {" · "}
                {formatWhen(entry.contactedAt)}
                {entry.notes ? ` — ${entry.notes}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <h2 className="font-semibold">Log contact</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Channel
            <select className={fieldClass} value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
              {CHANNELS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Next follow-up
            <select className={fieldClass} value={dueChoice} onChange={(event) => setDueChoice(event.target.value as "suggested" | "1" | "3" | "7")}>
              <option value="suggested">
                Suggested · {suggestedDays === 1 ? "tomorrow" : `in ${suggestedDays} days`}
              </option>
              <option value="1">Tomorrow</option>
              <option value="3">In 3 days</option>
              <option value="7">In 1 week</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm font-semibold">
          Notes
          <textarea
            className={`${fieldClass} min-h-20`}
            value={notes}
            placeholder="What did they say?"
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" className={secondaryButton} onClick={logContact}>
            Log contact
          </button>
          {logged ? <span className="text-sm text-brand">Saved. Follow-up date updated.</span> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label className="text-sm font-semibold">
            Draft follow-up
            <select
              className={fieldClass}
              value={draftChannel}
              onChange={(event) => setDraftChannel(event.target.value as FollowUpChannel)}
            >
              {FOLLOW_UP_CHANNELS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={primaryButton} disabled={draftLoading} onClick={() => void draftFollowUp()}>
            {draftLoading ? "Drafting…" : "Draft follow-up"}
          </button>
        </div>
        {draftError ? (
          <div className="mt-3">
            <ErrorBanner message={draftError} />
          </div>
        ) : null}
        {draft ? (
          <div className="mt-3 space-y-2">
            {draftChannel === "email" ? (
              <label className="block text-sm font-semibold">
                Subject
                <input
                  className={fieldClass}
                  value={draft.subject}
                  onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                />
              </label>
            ) : null}
            <label className="block text-sm font-semibold">
              Message
              <textarea
                className={`${fieldClass} min-h-32`}
                value={draft.message}
                onChange={(event) => setDraft({ ...draft, message: event.target.value })}
              />
            </label>
            {draftChannel === "sms" && draft.message.length > 320 ? (
              <p className="text-xs text-amber-800">This is longer than a typical SMS. Trim it before sending.</p>
            ) : null}
            <CopyButton text={copyText} label="Copy follow-up" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Uses the status and the notes you just logged. Edit it, then copy.</p>
        )}
      </section>
    </div>
  );
}
