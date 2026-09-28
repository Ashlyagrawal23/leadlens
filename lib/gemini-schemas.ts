import { Type, type Schema } from "@google/genai";

/**
 * Gemini response schemas. These live apart from lib/schemas.ts so the
 * browser bundle never imports the Gemini SDK. Zod still checks the text
 * the model returns; this schema only steers Gemini toward that shape.
 */

const str = (description: string): Schema => ({ type: Type.STRING, description });

const factorSchema = (range: string): Schema => ({
  type: Type.OBJECT,
  properties: {
    points: { type: Type.INTEGER, description: range },
    reason: str("One line citing evidence from the lead."),
  },
  required: ["points", "reason"],
});

export const analysisGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: str("At most two sentences."),
    intent: str("Short label such as Ready to buy, Comparing options, Investment, or Just browsing."),
    keyRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
    objections: { type: Type.ARRAY, items: { type: Type.STRING } },
    nextAction: str("One concrete action plus when to do it."),
    suggestedResponse: str("WhatsApp-ready message to the customer."),
    scoreBreakdown: {
      type: Type.OBJECT,
      properties: {
        budgetClarity: factorSchema("0 to 25"),
        timelineUrgency: factorSchema("0 to 25"),
        requirementSpecificity: factorSchema("0 to 20"),
        engagementSignals: factorSchema("0 to 20"),
        redFlagsPenalty: factorSchema("0 to -20, never positive"),
      },
      required: [
        "budgetClarity",
        "timelineUrgency",
        "requirementSpecificity",
        "engagementSignals",
        "redFlagsPenalty",
      ],
    },
    hardOverride: {
      type: Type.STRING,
      nullable: true,
      enum: ["hot", "warm", "cold"],
      description: "Null unless the rubric sum would mislead.",
    },
    hardOverrideReason: { type: Type.STRING, nullable: true },
    urgencyFlag: { type: Type.BOOLEAN },
    urgencyReason: str("One short sentence."),
  },
  required: [
    "summary",
    "intent",
    "keyRequirements",
    "objections",
    "nextAction",
    "suggestedResponse",
    "scoreBreakdown",
    "hardOverride",
    "hardOverrideReason",
    "urgencyFlag",
    "urgencyReason",
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

export const matchGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    matches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          propertyId: str("Must be an id from the candidates."),
          matchScore: { type: Type.INTEGER },
          whyItFits: str("One or two sentences."),
          possibleConcern: str("One drawback from the candidate data."),
        },
        required: ["propertyId", "matchScore", "whyItFits", "possibleConcern"],
      },
    },
  },
  required: ["matches"],
};

export const pitchGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    message: str("WhatsApp text about this one property."),
  },
  required: ["message"],
};

export const logCallGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    callSummary: str("One or two sentences."),
    customerSentiment: { type: Type.STRING, enum: ["positive", "neutral", "negative"] },
    newObjections: { type: Type.ARRAY, items: { type: Type.STRING } },
    commitments: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestedFollowUpDate: str("ISO 8601 datetime, not in the past."),
    suggestedNextAction: str("One concrete action."),
    statusSuggestion: {
      type: Type.STRING,
      enum: ["New", "Contacted", "Site Visit", "Negotiation", "Won", "Lost"],
    },
  },
  required: [
    "callSummary",
    "customerSentiment",
    "newObjections",
    "commitments",
    "suggestedFollowUpDate",
    "suggestedNextAction",
    "statusSuggestion",
  ],
};
