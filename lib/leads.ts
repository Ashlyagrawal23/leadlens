import type { Analysis, Lead, PlanChannel, Priority, ScoreBreakdown, Timeline } from "@/lib/types";

/**
 * Rules the model does not own.
 *
 * Sort order, overdue, and the pre-AI daily queue are deterministic so the
 * dashboard still works when Gemini is down. The bands below are the same
 * numbers written into the scoring rubric in lib/prompts.ts.
 *
 * Hard override: the model may set hardOverride to hot, warm, or cold when
 * the sum would mislead (spam, "do not contact", or a safety issue). The
 * score is still the sum. Only the badge follows the override, and the UI
 * shows the reason. A null override means the bands win:
 * hot >= 70, warm 40–69, cold < 40.
 */

export type LeadFilter = "all" | Priority;
export type LeadSort = "score" | "newest" | "followup";

const FACTOR_RANGE = {
  budgetClarity: [0, 25],
  timelineUrgency: [0, 25],
  requirementSpecificity: [0, 20],
  engagementSignals: [0, 20],
  redFlagsPenalty: [-20, 0],
} as const;

function clampFactor(points: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(points)));
}

/** Sum the five factors. The model is not asked for a score, and this ignores one if it sends it. */
export function computeScore(breakdown: ScoreBreakdown): number {
  const sum =
    breakdown.budgetClarity.points +
    breakdown.timelineUrgency.points +
    breakdown.requirementSpecificity.points +
    breakdown.engagementSignals.points +
    breakdown.redFlagsPenalty.points;
  return Math.max(0, Math.min(100, Math.round(sum)));
}

export function priorityFromScore(score: number, hardOverride: Priority | null = null): Priority {
  if (hardOverride) return hardOverride;
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

/** Clamp each factor to its rubric range, then set score, priority, and the short reasons. */
export function finalizeAnalysis(
  input: Omit<Analysis, "score" | "priority" | "scoreReasoning">,
): Analysis {
  const scoreBreakdown: ScoreBreakdown = {
    budgetClarity: {
      ...input.scoreBreakdown.budgetClarity,
      points: clampFactor(input.scoreBreakdown.budgetClarity.points, ...FACTOR_RANGE.budgetClarity),
    },
    timelineUrgency: {
      ...input.scoreBreakdown.timelineUrgency,
      points: clampFactor(input.scoreBreakdown.timelineUrgency.points, ...FACTOR_RANGE.timelineUrgency),
    },
    requirementSpecificity: {
      ...input.scoreBreakdown.requirementSpecificity,
      points: clampFactor(
        input.scoreBreakdown.requirementSpecificity.points,
        ...FACTOR_RANGE.requirementSpecificity,
      ),
    },
    engagementSignals: {
      ...input.scoreBreakdown.engagementSignals,
      points: clampFactor(input.scoreBreakdown.engagementSignals.points, ...FACTOR_RANGE.engagementSignals),
    },
    redFlagsPenalty: {
      ...input.scoreBreakdown.redFlagsPenalty,
      points: clampFactor(input.scoreBreakdown.redFlagsPenalty.points, ...FACTOR_RANGE.redFlagsPenalty),
    },
  };
  const score = computeScore(scoreBreakdown);
  return {
    ...input,
    scoreBreakdown,
    score,
    priority: priorityFromScore(score, input.hardOverride),
    scoreReasoning: [
      scoreBreakdown.budgetClarity.reason,
      scoreBreakdown.timelineUrgency.reason,
      scoreBreakdown.requirementSpecificity.reason,
      scoreBreakdown.engagementSignals.reason,
      scoreBreakdown.redFlagsPenalty.reason,
    ],
  };
}

/** How many days out the next follow-up should land after a new lead or a logged contact. */
export function followUpOffsetDays(timeline: Timeline, urgent: boolean): number {
  if (urgent || timeline === "Immediate") return 1;
  if (timeline === "1-3 months") return 3;
  if (timeline === "3-6 months") return 7;
  if (timeline === "6+ months") return 14;
  return 21;
}

export function addDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
}

export function daysAgo(days: number, hour = 11): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export function daysFromNow(days: number, hour = 18): string {
  return daysAgo(-days, hour);
}

export function isClosed(lead: Lead): boolean {
  return lead.status === "Won" || lead.status === "Lost";
}

export function isOverdue(lead: Lead, now = Date.now()): boolean {
  if (!lead.followUpDueAt || isClosed(lead)) return false;
  return new Date(lead.followUpDueAt).getTime() < now;
}

function dueTime(lead: Lead): number {
  if (isClosed(lead) || !lead.followUpDueAt) return Number.POSITIVE_INFINITY;
  return new Date(lead.followUpDueAt).getTime();
}

export function visibleLeads(leads: Lead[], filter: LeadFilter, sort: LeadSort): Lead[] {
  const filtered =
    filter === "all" ? leads : leads.filter((lead) => lead.analysis?.priority === filter);

  return [...filtered].sort((a, b) => {
    if (sort === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sort === "followup") {
      const byDue = dueTime(a) - dueTime(b);
      if (byDue !== 0) return byDue;
    }
    return (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1);
  });
}

/** Active leads, overdue first, then soonest follow-up, then higher score. */
export function ruleQueue(leads: Lead[]): Lead[] {
  return leads.filter((lead) => !isClosed(lead)).sort((a, b) => {
    const byDue = dueTime(a) - dueTime(b);
    if (byDue !== 0) return byDue;
    return (b.analysis?.score ?? 0) - (a.analysis?.score ?? 0);
  });
}

export function ruleReason(lead: Lead): string {
  if (isOverdue(lead)) return "Follow-up date has passed.";
  if (lead.analysis?.urgencyFlag) return lead.analysis.urgencyReason;
  if ((lead.analysis?.score ?? 0) >= 75) return "High score and still open.";
  return lead.analysis?.nextAction ?? "No analysis yet.";
}

export function ruleChannel(lead: Lead): PlanChannel {
  if (lead.analysis?.urgencyFlag || (lead.analysis?.score ?? 0) >= 75) return "call";
  if (lead.status === "Negotiation") return "email";
  return "whatsapp";
}

/** A simple morning schedule used before the model has planned the day. */
export function ruleTime(index: number): string {
  const start = 10 * 60 + 30 + index * 40;
  const format = (minutes: number) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${hour}:${minute.toString().padStart(2, "0")}`;
  };
  return `${format(start)}–${format(start + 30)}`;
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function dueLabel(iso: string | null, now = new Date()): string {
  if (!iso) return "No follow-up set";
  const due = new Date(iso);
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOf(due) - startOf(now)) / 86_400_000);
  const short = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(due);
  if (diffDays < 0) return `Overdue · ${short}`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due ${short}`;
}

export function todayLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

export function newId(): string {
  return crypto.randomUUID();
}
