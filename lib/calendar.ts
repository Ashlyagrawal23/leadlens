import { isClosed } from "@/lib/leads";
import type { Lead } from "@/lib/types";

/**
 * Follow-up agenda buckets and an .ics export.
 *
 * The .ics file is the one format Google Calendar, Outlook, and Apple
 * Calendar all import, so follow-ups land where the salesperson already
 * looks, with a reminder, without any calendar API or OAuth.
 */

export type AgendaBucket = "overdue" | "today" | "tomorrow" | "week" | "later";

export const BUCKET_LABEL: Record<AgendaBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "Next 7 days",
  later: "Later",
};

export const BUCKET_ORDER: AgendaBucket[] = ["overdue", "today", "tomorrow", "week", "later"];

function startOfDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function bucketFor(dueIso: string, now = Date.now()): AgendaBucket {
  const due = new Date(dueIso).getTime();
  if (due < now) return "overdue";
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "week";
  return "later";
}

/** Open leads with a follow-up date, grouped by bucket and sorted by due time inside each. */
export function buildAgenda(leads: Lead[], now = Date.now()): Array<{ bucket: AgendaBucket; leads: Lead[] }> {
  const groups = new Map<AgendaBucket, Lead[]>();
  for (const lead of leads) {
    if (isClosed(lead) || !lead.followUpDueAt) continue;
    const bucket = bucketFor(lead.followUpDueAt, now);
    groups.set(bucket, [...(groups.get(bucket) ?? []), lead]);
  }
  return BUCKET_ORDER.flatMap((bucket) => {
    const items = groups.get(bucket);
    if (!items) return [];
    items.sort((a, b) => (a.followUpDueAt ?? "").localeCompare(b.followUpDueAt ?? ""));
    return [{ bucket, leads: items }];
  });
}

/** 20260929T123000Z. Calendar apps convert UTC to the viewer's zone. */
function icsTime(time: number): string {
  return new Date(time)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** RFC 5545 text escaping: backslash, semicolon, comma, and newlines. */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 says lines longer than 75 octets must be folded: CRLF plus one space.
 * Counting UTF-8 bytes matters because ₹ is three bytes, not one character.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // The first line may hold 75 octets. Continuation lines lose one to the leading space.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/**
 * One 30-minute event per open follow-up, with a 15-minute reminder.
 * A follow-up that is already overdue is placed 30 minutes from now instead
 * of in the past, where no calendar would ever remind anyone.
 */
export function leadsToIcs(leads: Lead[], origin: string, now = Date.now()): string {
  const events = leads
    .filter((lead) => !isClosed(lead) && lead.followUpDueAt)
    .map((lead) => {
      const due = new Date(lead.followUpDueAt as string).getTime();
      const start = due < now ? now + 30 * 60_000 : due;
      const details = [
        lead.analysis?.nextAction ?? "Follow up.",
        `${lead.location} · ${lead.budget} · ${lead.timeline}`,
        lead.phone ? `Phone: ${lead.phone}` : "",
        `${origin}/leads/${lead.id}`,
      ]
        .filter(Boolean)
        .join("\n");
      const priority = lead.analysis ? ` (${lead.analysis.priority})` : "";
      return [
        "BEGIN:VEVENT",
        // Same UID on every export, so re-importing updates the event instead of duplicating it.
        `UID:${lead.id}@leadlens`,
        `DTSTAMP:${icsTime(now)}`,
        `DTSTART:${icsTime(start)}`,
        `DTEND:${icsTime(start + 30 * 60_000)}`,
        `SUMMARY:${icsEscape(`Follow up: ${lead.name}${priority}`)}`,
        `DESCRIPTION:${icsEscape(details)}`,
        `URL:${origin}/leads/${lead.id}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-PT15M",
        `DESCRIPTION:${icsEscape(`Follow up with ${lead.name}`)}`,
        "END:VALARM",
        "END:VEVENT",
      ];
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LeadLens//Follow-ups//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flat(),
    "END:VCALENDAR",
  ]
    .map(foldLine)
    .join("\r\n");
}
