import { canonicalCity, parseBudgetInr } from "@/lib/inventory";
import { isClosed, isOverdue } from "@/lib/leads";
import { normalizePhone } from "@/lib/phone";
import { PRIORITIES, STATUSES, type Intake, type Lead, type LeadStatus, type Priority } from "@/lib/types";

/**
 * Pipeline numbers for the Insights page, search for the inbox, CSV export,
 * and duplicate detection. Everything here is plain arithmetic on the leads
 * in this browser. No model call, so it works when both AI quotas are gone.
 */

const DAY_MS = 86_400_000;
/** An open lead with no contact for this many days is "going cold". */
export const STALE_AFTER_DAYS = 5;

export interface StatusCount {
  status: LeadStatus;
  count: number;
  avgScore: number | null;
}

export interface CityCount {
  city: string;
  count: number;
  hot: number;
}

export interface PipelineInsights {
  total: number;
  open: number;
  won: number;
  lost: number;
  /** Won ÷ (Won + Lost). Null until at least one lead has closed. */
  winRate: number | null;
  overdue: number;
  stale: Lead[];
  byStatus: StatusCount[];
  byPriority: Record<Priority | "unscored", number>;
  avgScore: number | null;
  /** Median hours from lead creation to the first logged contact. */
  medianHoursToFirstContact: number | null;
  contactedCount: number;
  topCities: CityCount[];
  /** Sum of the budgets we could read on open leads, in rupees. */
  openPipelineInr: number;
  /** Open leads whose budget had no number in it ("Not sure"). */
  openWithoutBudget: number;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** First contact is the earliest call note or contact log, whichever came first. */
export function firstContactAt(lead: Lead): string | null {
  const times = [
    ...lead.contactLogs.map((log) => log.contactedAt),
    ...lead.callNotes.map((note) => note.contactedAt),
  ].sort();
  return times[0] ?? null;
}

/** Days since the last touch, or since creation when nobody has contacted the lead. */
export function daysSinceTouch(lead: Lead, now = Date.now()): number {
  const last = lead.lastContactedAt ?? lead.createdAt;
  return Math.floor((now - new Date(last).getTime()) / DAY_MS);
}

export function isStale(lead: Lead, now = Date.now()): boolean {
  return !isClosed(lead) && daysSinceTouch(lead, now) >= STALE_AFTER_DAYS;
}

/** "Noida, Sector 150" and "noida" are one city, and so are "Gurgaon" and "Gurugram". */
export function cityOf(location: string): string {
  const known = canonicalCity(location);
  const first = known ?? location.split(",")[0]?.trim() ?? "";
  if (!first) return "Unknown";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function buildInsights(leads: Lead[], now = Date.now()): PipelineInsights {
  const won = leads.filter((lead) => lead.status === "Won").length;
  const lost = leads.filter((lead) => lead.status === "Lost").length;

  const byStatus = STATUSES.map((status) => {
    const inStatus = leads.filter((lead) => lead.status === status);
    return {
      status,
      count: inStatus.length,
      avgScore: average(inStatus.flatMap((lead) => (lead.analysis ? [lead.analysis.score] : []))),
    };
  });

  const byPriority = { hot: 0, warm: 0, cold: 0, unscored: 0 };
  for (const lead of leads) byPriority[lead.analysis?.priority ?? "unscored"] += 1;

  const hoursToFirst = leads.flatMap((lead) => {
    const first = firstContactAt(lead);
    if (!first) return [];
    const hours = (new Date(first).getTime() - new Date(lead.createdAt).getTime()) / 3_600_000;
    // Seed data can log a contact before createdAt. Negative gaps are noise, not speed.
    return hours >= 0 ? [hours] : [];
  });

  const cities = new Map<string, CityCount>();
  for (const lead of leads) {
    const city = cityOf(lead.location);
    const entry = cities.get(city) ?? { city, count: 0, hot: 0 };
    entry.count += 1;
    if (lead.analysis?.priority === "hot") entry.hot += 1;
    cities.set(city, entry);
  }

  const medianHours = median(hoursToFirst);
  const openBudgets = leads.filter((lead) => !isClosed(lead)).map((lead) => parseBudgetInr(lead.budget));

  return {
    total: leads.length,
    open: leads.filter((lead) => !isClosed(lead)).length,
    won,
    lost,
    winRate: won + lost > 0 ? won / (won + lost) : null,
    overdue: leads.filter((lead) => isOverdue(lead, now)).length,
    stale: leads
      .filter((lead) => isStale(lead, now))
      .sort((a, b) => daysSinceTouch(b, now) - daysSinceTouch(a, now)),
    byStatus,
    byPriority,
    avgScore: average(leads.flatMap((lead) => (lead.analysis ? [lead.analysis.score] : []))),
    medianHoursToFirstContact: medianHours === null ? null : Math.round(medianHours * 10) / 10,
    contactedCount: hoursToFirst.length,
    topCities: [...cities.values()].sort((a, b) => b.count - a.count || b.hot - a.hot).slice(0, 5),
    openPipelineInr: openBudgets.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    openWithoutBudget: openBudgets.filter((value) => value === null).length,
  };
}

export const PRIORITY_ORDER: Array<Priority | "unscored"> = [...PRIORITIES, "unscored"];

/**
 * Case-insensitive search across the fields a salesperson remembers:
 * name, place, phone digits, requirement, budget, and the AI summary.
 * Every word must match somewhere, so "noida 3 bhk" narrows instead of widening.
 */
export function matchesSearch(lead: Lead, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [
    lead.name,
    lead.location,
    lead.phone.replace(/\D/g, ""),
    lead.propertyRequirement,
    lead.budget,
    lead.status,
    lead.analysis?.summary ?? "",
    lead.analysis?.intent ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Leads that are probably the same customer as the intake being typed.
 * Same phone is a sure match. Same name in the same city is a likely one.
 */
export interface DuplicateMatch {
  lead: Lead;
  reason: "phone" | "name";
}

export function findDuplicates(
  intake: Pick<Intake, "name" | "location" | "phone">,
  leads: Lead[],
): DuplicateMatch[] {
  const phone = normalizePhone(intake.phone);
  const name = normalizeName(intake.name);
  const city = intake.location.trim() ? cityOf(intake.location) : null;

  return leads.flatMap((lead): DuplicateMatch[] => {
    if (phone && normalizePhone(lead.phone) === phone) return [{ lead, reason: "phone" }];
    if (name.length >= 3 && normalizeName(lead.name) === name && (!city || cityOf(lead.location) === city)) {
      return [{ lead, reason: "name" }];
    }
    return [];
  });
}

/** RFC 4180 quoting. A leading = + - @ is prefixed with ' so spreadsheets do not run it as a formula. */
function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = [
    "Name",
    "Phone",
    "Location",
    "Requirement",
    "Budget",
    "Budget (INR)",
    "Timeline",
    "Status",
    "Priority",
    "Score",
    "Intent",
    "Next action",
    "Follow-up due",
    "Last contacted",
    "Created",
  ];
  const rows = leads.map((lead) => [
    lead.name,
    lead.phone,
    lead.location,
    lead.propertyRequirement,
    lead.budget,
    parseBudgetInr(lead.budget),
    lead.timeline,
    lead.status,
    lead.analysis?.priority ?? "",
    lead.analysis?.score ?? null,
    lead.analysis?.intent ?? "",
    lead.analysis?.nextAction ?? "",
    lead.followUpDueAt,
    lead.lastContactedAt,
    lead.createdAt,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
