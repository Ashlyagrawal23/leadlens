/**
 * Domain types for LeadLens.
 *
 * These are the nouns of the product. Zod schemas in lib/schemas.ts must
 * accept and produce these same shapes. If a field changes, update both.
 */

export const TIMELINES = [
  "Immediate",
  "1-3 months",
  "3-6 months",
  "6+ months",
  "Just exploring",
] as const;

export type Timeline = (typeof TIMELINES)[number];

export const PRIORITIES = ["hot", "warm", "cold"] as const;

export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = [
  "New",
  "Contacted",
  "Site Visit",
  "Negotiation",
  "Won",
  "Lost",
] as const;

export type LeadStatus = (typeof STATUSES)[number];

/** Channels a salesperson can actually use for a follow-up. */
export const CHANNELS = ["call", "whatsapp", "email", "sms"] as const;

export type Channel = (typeof CHANNELS)[number];

/** Channels the daily plan is allowed to recommend. SMS is too short for a plan slot. */
export const PLAN_CHANNELS = ["call", "whatsapp", "email"] as const;

export type PlanChannel = (typeof PLAN_CHANNELS)[number];

export const FOLLOW_UP_CHANNELS = ["whatsapp", "email", "sms"] as const;

export type FollowUpChannel = (typeof FOLLOW_UP_CHANNELS)[number];

export type AiProvider = "gemini" | "groq";

/** Who produced the analysis. "seed" means a handwritten demo, not a live model call. */
export type AnalysisSource = AiProvider | "seed";

/** What the salesperson types into the intake form. */
export interface Intake {
  name: string;
  location: string;
  propertyRequirement: string;
  budget: string;
  timeline: Timeline;
  message: string;
}

/** Structured output of /api/analyze. Every field is shown on the lead card. */
export interface Analysis {
  summary: string;
  intent: string;
  keyRequirements: string[];
  objections: string[];
  nextAction: string;
  suggestedResponse: string;
  score: number;
  priority: Priority;
  urgencyFlag: boolean;
  urgencyReason: string;
  scoreReasoning: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set when the model rewrote a customer-facing message. Null for normal answers. */
  rewrittenMessage: string | null;
  createdAt: string;
}

export interface ContactLog {
  id: string;
  channel: Channel;
  notes: string;
  contactedAt: string;
}

export interface Lead {
  id: string;
  name: string;
  location: string;
  propertyRequirement: string;
  budget: string;
  timeline: Timeline;
  message: string;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  lastContactedAt: string | null;
  followUpDueAt: string | null;
  contactLogs: ContactLog[];
  analysis: Analysis | null;
  chat: ChatMessage[];
  analyzedBy: AnalysisSource | null;
}

export interface PlanItem {
  leadId: string;
  reason: string;
  timeOfDay: string;
  channel: PlanChannel;
}

export interface DayPlan {
  focus: string;
  items: PlanItem[];
  provider: AiProvider;
}

export interface CallBrief {
  opener: string;
  talkingPoints: string[];
  objections: Array<{ objection: string; rebuttal: string }>;
  ask: string;
  provider: AiProvider;
}

export interface FollowUpDraft {
  channel: FollowUpChannel;
  subject: string | null;
  message: string;
  provider: AiProvider;
}
