"use client";

import Link from "next/link";
import { PriorityBadge, secondaryButton } from "@/components/ui";
import { buildAgenda, BUCKET_LABEL, leadsToIcs } from "@/lib/calendar";
import { downloadText, localDateStamp } from "@/lib/download";
import { formatWhen } from "@/lib/leads";
import type { Lead } from "@/lib/types";

/** Every open follow-up, grouped by when it is due, with a one-click calendar export. */
export function FollowUpAgenda({ leads }: { leads: Lead[] }) {
  const agenda = buildAgenda(leads);
  const count = agenda.reduce((sum, group) => sum + group.leads.length, 0);

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Follow-up agenda</h2>
          <p className="text-sm text-muted">
            {count} open follow-up{count === 1 ? "" : "s"}. The calendar file works with Google Calendar,
            Outlook, and Apple Calendar, with a reminder 15 minutes before each.
          </p>
        </div>
        <button
          type="button"
          className={secondaryButton}
          disabled={count === 0}
          onClick={() =>
            downloadText(
              `leadlens-followups-${localDateStamp()}.ics`,
              leadsToIcs(leads, window.location.origin),
              "text/calendar;charset=utf-8",
            )
          }
        >
          Add to calendar (.ics)
        </button>
      </div>

      {count === 0 ? (
        <p className="mt-3 text-sm">No open follow-ups are scheduled.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {agenda.map((group) => (
            <div key={group.bucket}>
              <h3
                className={`text-xs font-semibold tracking-wide uppercase ${
                  group.bucket === "overdue" ? "text-orange-800" : "text-muted"
                }`}
              >
                {BUCKET_LABEL[group.bucket]} · {group.leads.length}
              </h3>
              <ul className="mt-1 divide-y divide-line">
                {group.leads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="flex items-center justify-between gap-3 py-2 hover:bg-stone-50"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 font-medium">{lead.name}</span>
                        {lead.analysis ? (
                          <span className="shrink-0">
                            <PriorityBadge priority={lead.analysis.priority} />
                          </span>
                        ) : null}
                        <span className="hidden min-w-0 truncate text-sm text-muted sm:inline">
                          {lead.analysis?.nextAction ?? lead.status}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-muted">
                        {formatWhen(lead.followUpDueAt as string)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
