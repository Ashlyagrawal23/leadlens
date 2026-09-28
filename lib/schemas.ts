import { z } from "zod";
import {
  CHANNELS,
  FOLLOW_UP_CHANNELS,
  PLAN_CHANNELS,
  PRIORITIES,
  STATUSES,
  TIMELINES,
  type Analysis,
  type CallInsight,
  type CallNote,
  type ChatMessage,
  type ContactLog,
  type Intake,
  type Lead,
  type PropertyMatch,
  type ScoreBreakdown,
} from "@/lib/types";

/**
 * Request and response schemas.
 *
 * The browser and the API routes import the same schemas, so a field that
 * fails on the server fails the same way in the form. Limits also protect
 * the Gemini free tier from huge prompts.
 */

export const LIMITS = {
  name: 80,
  location: 120,
  property: 300,
  budget: 80,
  message: 4000,
  question: 2000,
  notes: 2000,
} as const;

export const intakeSchema: z.ZodType<Intake> = z.object({
  name: z.string().trim().min(1, "Name is required").max(LIMITS.name),
  location: z.string().trim().min(1, "Location is required").max(LIMITS.location),
  propertyRequirement: z
    .string()
    .trim()
    .min(1, "Property requirement is required")
    .max(LIMITS.property),
  budget: z.string().trim().min(1, "Budget is required").max(LIMITS.budget),
  timeline: z.enum(TIMELINES),
  message: z
    .string()
    .trim()
    .min(1, "Customer message is required")
    .max(LIMITS.message, "Keep the message under 4000 characters"),
  phone: z.string().trim().max(20, "Phone is too long"),
});

const bullet = z.string().trim().min(1).max(300);

const factor = (min: number, max: number) =>
  z.object({
    points: z.number().int().min(min).max(max),
    reason: z.string().trim().min(1).max(300),
  });

/** What the model is allowed to return. Score and priority are not in here. */
export const modelAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  intent: z.string().trim().min(1).max(80),
  keyRequirements: z.array(bullet).max(8),
  objections: z.array(bullet).max(8),
  nextAction: z.string().trim().min(1).max(400),
  suggestedResponse: z.string().trim().min(1).max(1200),
  scoreBreakdown: z.object({
    budgetClarity: factor(0, 25),
    timelineUrgency: factor(0, 25),
    requirementSpecificity: factor(0, 20),
    engagementSignals: factor(0, 20),
    redFlagsPenalty: factor(-20, 0),
  }) satisfies z.ZodType<ScoreBreakdown>,
  hardOverride: z.enum(PRIORITIES).nullable().optional(),
  hardOverrideReason: z.string().trim().max(240).nullable().optional(),
  urgencyFlag: z.boolean(),
  urgencyReason: z.string().trim().min(1).max(240),
});

export const analysisSchema: z.ZodType<Analysis> = z.object({
  summary: z.string().trim().min(1).max(600),
  intent: z.string().trim().min(1).max(80),
  keyRequirements: z.array(bullet).max(8),
  objections: z.array(bullet).max(8),
  nextAction: z.string().trim().min(1).max(400),
  suggestedResponse: z.string().trim().min(1).max(1200),
  scoreBreakdown: z.object({
    budgetClarity: factor(0, 25),
    timelineUrgency: factor(0, 25),
    requirementSpecificity: factor(0, 20),
    engagementSignals: factor(0, 20),
    redFlagsPenalty: factor(-20, 0),
  }),
  hardOverride: z.enum(PRIORITIES).nullable(),
  hardOverrideReason: z.string().max(240).nullable(),
  score: z.number().int().min(0).max(100),
  priority: z.enum(PRIORITIES),
  urgencyFlag: z.boolean(),
  urgencyReason: z.string().trim().min(1).max(240),
  scoreReasoning: z.array(bullet).min(1).max(5),
});

export const propertyMatchSchema: z.ZodType<PropertyMatch> = z.object({
  propertyId: z.string().min(1).max(40),
  matchScore: z.number().int().min(0).max(100),
  whyItFits: z.string().trim().min(1).max(400),
  possibleConcern: z.string().trim().min(1).max(300),
});

export const callInsightSchema: z.ZodType<CallInsight> = z.object({
  callSummary: z.string().trim().min(1).max(500),
  customerSentiment: z.enum(["positive", "neutral", "negative"]),
  newObjections: z.array(bullet).max(6),
  commitments: z.array(bullet).max(6),
  suggestedFollowUpDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Date must be ISO"),
  suggestedNextAction: z.string().trim().min(1).max(400),
  statusSuggestion: z.enum(STATUSES),
});

export const callNoteSchema: z.ZodType<CallNote> = z.object({
  id: z.string().min(1).max(80),
  transcript: z.string().min(1).max(LIMITS.notes),
  contactedAt: z.string().min(1),
  result: callInsightSchema,
});

export const chatMessageSchema: z.ZodType<ChatMessage> = z.object({
  id: z.string().min(1).max(80),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
  rewrittenMessage: z.string().max(2000).nullable(),
  createdAt: z.string().min(1),
});

export const contactLogSchema: z.ZodType<ContactLog> = z.object({
  id: z.string().min(1).max(80),
  channel: z.enum(CHANNELS),
  notes: z.string().max(LIMITS.notes),
  contactedAt: z.string().min(1),
});

export const leadSchema: z.ZodType<Lead> = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(LIMITS.name),
  location: z.string().min(1).max(LIMITS.location),
  propertyRequirement: z.string().min(1).max(LIMITS.property),
  budget: z.string().min(1).max(LIMITS.budget),
  timeline: z.enum(TIMELINES),
  message: z.string().min(1).max(LIMITS.message),
  phone: z.string().max(20),
  status: z.enum(STATUSES),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastContactedAt: z.string().nullable(),
  followUpDueAt: z.string().nullable(),
  contactLogs: z.array(contactLogSchema).max(50),
  callNotes: z.array(callNoteSchema).max(30),
  matches: z.array(propertyMatchSchema).max(3),
  analysis: analysisSchema.nullable(),
  chat: z.array(chatMessageSchema).max(40),
  analyzedBy: z.enum(["gemini", "groq", "seed"]).nullable(),
});

export const leadListSchema = z.array(leadSchema).max(100);

export const chatRequestSchema = z.object({
  lead: leadSchema,
  question: z
    .string()
    .trim()
    .min(1, "Type a question first")
    .max(LIMITS.question, "Keep the question under 2000 characters"),
});

export const planRequestSchema = z.object({
  leads: z.array(leadSchema).min(1).max(50),
});

export const briefRequestSchema = z.object({
  lead: leadSchema,
});

export const followUpRequestSchema = z.object({
  lead: leadSchema,
  channel: z.enum(FOLLOW_UP_CHANNELS),
});

export const chatResultSchema = z.object({
  reply: z.string().trim().min(1).max(4000),
  rewrittenMessage: z.string().trim().max(2000).nullable().optional(),
});

export const planResultSchema = z.object({
  focus: z.string().trim().min(1).max(300),
  items: z
    .array(
      z.object({
        leadId: z.string().min(1).max(80),
        reason: z.string().trim().min(1).max(300),
        timeOfDay: z.string().trim().min(1).max(40),
        channel: z.enum(PLAN_CHANNELS),
      }),
    )
    .min(1)
    .max(50),
});

export const briefResultSchema = z.object({
  opener: z.string().trim().min(1).max(400),
  talkingPoints: z.array(bullet).min(1).max(6),
  objections: z
    .array(
      z.object({
        objection: bullet,
        rebuttal: bullet,
      }),
    )
    .max(6),
  ask: z.string().trim().min(1).max(400),
});

export const followUpResultSchema = z.object({
  subject: z.string().trim().max(140).nullable().optional(),
  message: z.string().trim().min(1).max(2000),
});

export const providerSchema = z.enum(["gemini", "groq"]);

/** What /api/analyze returns to the browser. */
export const analyzeResponseSchema = z.object({
  analysis: analysisSchema,
  provider: providerSchema,
});

export const chatResponseSchema = z.object({
  reply: z.string().min(1),
  rewrittenMessage: z.string().nullable(),
  provider: providerSchema,
});

export const planResponseSchema = z.object({
  focus: z.string(),
  items: planResultSchema.shape.items,
  provider: providerSchema,
});

export const briefResponseSchema = z.object({
  opener: z.string(),
  talkingPoints: z.array(z.string()),
  objections: z.array(z.object({ objection: z.string(), rebuttal: z.string() })),
  ask: z.string(),
  provider: providerSchema,
});

export const matchResultSchema = z.object({
  matches: z.array(propertyMatchSchema).min(1).max(3),
});

export const matchResponseSchema = z.object({
  matches: z.array(propertyMatchSchema).max(3),
  message: z.string().nullable(),
  provider: providerSchema.nullable(),
});

export const pitchResponseSchema = z.object({
  message: z.string().min(1),
  provider: providerSchema,
});

export const logCallResponseSchema = z.object({
  insight: callInsightSchema,
  provider: providerSchema,
});

export const followUpResponseSchema = z.object({
  channel: z.enum(FOLLOW_UP_CHANNELS),
  subject: z.string().nullable(),
  message: z.string(),
  provider: providerSchema,
});
