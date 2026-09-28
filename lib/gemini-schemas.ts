import { Type, type Schema } from "@google/genai";

/**
 * Gemini response schemas. These live apart from lib/schemas.ts so the
 * browser bundle never imports the Gemini SDK. Zod still checks the text
 * the model returns; this schema only steers Gemini toward that shape.
 */

const str = (description: string): Schema => ({ type: Type.STRING, description });

export const analysisGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: str("At most two sentences."),
    intent: str("Short label such as Ready to buy, Comparing options, Investment, or Just browsing."),
    keyRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
    objections: { type: Type.ARRAY, items: { type: Type.STRING } },
    nextAction: str("One concrete action plus when to do it."),
    suggestedResponse: str("WhatsApp-ready message to the customer."),
    score: { type: Type.INTEGER, description: "Integer from 0 to 100 using the rubric." },
    priority: { type: Type.STRING, enum: ["hot", "warm", "cold"] },
    urgencyFlag: { type: Type.BOOLEAN },
    urgencyReason: str("One short sentence."),
    scoreReasoning: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "One or two short bullets.",
    },
  },
  required: [
    "summary",
    "intent",
    "keyRequirements",
    "objections",
    "nextAction",
    "suggestedResponse",
    "score",
    "priority",
    "urgencyFlag",
    "urgencyReason",
    "scoreReasoning",
  ],
};

export const chatGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: str("What the salesperson should read. Not the customer-facing text if a rewrite was requested."),
    rewrittenMessage: {
      type: Type.STRING,
      nullable: true,
      description: "The sendable customer message, or null when no rewrite was asked for.",
    },
  },
  required: ["reply", "rewrittenMessage"],
};

export const planGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    focus: str("One sentence describing the theme of the day."),
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          leadId: str("Must be an id from the input."),
          reason: str("One sentence the salesperson can read in a few seconds."),
          timeOfDay: str("A clock window such as 10:30–11:00."),
          channel: { type: Type.STRING, enum: ["call", "whatsapp", "email"] },
        },
        required: ["leadId", "reason", "timeOfDay", "channel"],
      },
    },
  },
  required: ["focus", "items"],
};

export const briefGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    opener: str("One sentence the salesperson can say out loud."),
    talkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    objections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          objection: { type: Type.STRING },
          rebuttal: { type: Type.STRING },
        },
        required: ["objection", "rebuttal"],
      },
    },
    ask: str("The single close for this call."),
  },
  required: ["opener", "talkingPoints", "objections", "ask"],
};

export const followUpGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subject: {
      type: Type.STRING,
      nullable: true,
      description: "Email subject, or null for WhatsApp and SMS.",
    },
    message: str("The message body, adapted to the channel."),
  },
  required: ["subject", "message"],
};
