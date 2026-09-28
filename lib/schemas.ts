import { z } from "zod";
import {
  CHANNELS,
  FOLLOW_UP_CHANNELS,
  PLAN_CHANNELS,
  PRIORITIES,
  STATUSES,
  TIMELINES,
  type Analysis,
  type ChatMessage,
  type ContactLog,
  type Intake,
  type Lead,
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
});

const bullet = z.string().trim().min(1).max(300);

export const analysisSchema: z.ZodType<Analysis> = z.object({
  summary: z.string().trim().min(1).max(600),
  intent: z.string().trim().min(1).max(80),
  keyRequirements: z.array(bullet).max(8),
  objections: z.array(bullet).max(8),
  nextAction: z.string().trim().min(1).max(400),
  suggestedResponse: z.string().trim().min(1).max(1200),
  score: z.number().int().min(0).max(100),
  priority: z.enum(PRIORITIES),
  urgencyFlag: z.boolean(),
  urgencyReason: z.string().trim().min(1).max(240),
  // The prompt asks for 1–2 bullets. Max 4 lets a slightly chatty model
  // through; the analyze route keeps only the first two.
  scoreReasoning: z.array(bullet).min(1).max(4),
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
  status: z.enum(STATUSES),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastContactedAt: z.string().nullable(),
  followUpDueAt: z.string().nullable(),
  contactLogs: z.array(contactLogSchema).max(50),
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

export const followUpResponseSchema = z.object({
  channel: z.enum(FOLLOW_UP_CHANNELS),
  subject: z.string().nullable(),
  message: z.string(),
  provider: providerSchema,
});
