import { ApiError, GoogleGenAI, type Schema } from "@google/genai";
import type { z } from "zod";

/**
 * One wrapper for both model providers.
 *
 * Flow, matching the assignment:
 * 1. Call Gemini (responseMimeType application/json + responseSchema).
 * 2. Parse JSON and validate with Zod. On any failure, retry Gemini once.
 * 3. If Gemini still fails and GROQ_API_KEY is set, call Groq once.
 *
 * Routes never talk to a provider directly, so swapping the model is a
 * change in this file.
 */

// New Gemini keys are rejected for gemini-2.0-flash and gemini-2.5-flash.
// gemini-3.8-flash is the current model those keys are told to use.
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
// The assignment named llama-3.3-70b-versatile. Groq has removed that model.
// gpt-oss-120b is a current free-tier chat model that accepts JSON mode.
// Override with GROQ_MODEL if Groq renames it again.
const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 22_000;

export type LlmCode = "NO_KEY" | "RATE_LIMIT" | "TIMEOUT" | "UPSTREAM" | "INVALID_JSON";

export class LlmError extends Error {
  readonly status: number;

  constructor(
    readonly code: LlmCode,
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
    this.status =
      code === "NO_KEY" ? 503 : code === "RATE_LIMIT" ? 429 : code === "TIMEOUT" ? 504 : 502;
  }
}

export interface LlmResult<T> {
  data: T;
  provider: "gemini" | "groq";
}

/**
 * Models sometimes return 74.2, "Hot", or "" for an optional string.
 * We only coerce those safe cases. Anything else still fails Zod, which
 * triggers the single retry.
 */
function coerceModelJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(coerceModelJson);
  if (!value || typeof value !== "object") return value;

  const record: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    record[key] = coerceModelJson(child);
  }

  if (typeof record.score === "number") record.score = Math.round(record.score);
  if (typeof record.score === "string" && record.score.trim() !== "") {
    const parsed = Number(record.score);
    if (!Number.isNaN(parsed)) record.score = Math.round(parsed);
  }
  if (typeof record.priority === "string") record.priority = record.priority.toLowerCase();
  if (typeof record.channel === "string") record.channel = record.channel.toLowerCase();
  if (record.rewrittenMessage === "") record.rewrittenMessage = null;
  if (record.subject === "") record.subject = null;
  return record;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced?.[1] ?? trimmed;
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new LlmError("INVALID_JSON", "The model did not return valid JSON.");
  }
}

function normalize(error: unknown): LlmError {
  if (error instanceof LlmError) return error;
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new LlmError(
        "RATE_LIMIT",
        "The free-tier rate limit was hit. Wait a minute and try again.",
      );
    }
    if (error.status === 401 || error.status === 403) {
      return new LlmError(
        "UPSTREAM",
        "The AI provider rejected the API key. Check the server environment variables.",
      );
    }
    return new LlmError("UPSTREAM", "The AI provider returned an error. Please try again.");
  }
  if (error instanceof Error && /timeout|aborted|abort/i.test(`${error.name} ${error.message}`)) {
    return new LlmError("TIMEOUT", "The model took too long to respond. Please try again.");
  }
  return new LlmError("UPSTREAM", "The AI provider could not be reached. Please try again.");
}

async function callGemini(system: string, user: string, geminiSchema: Schema): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new LlmError("NO_KEY", "Add GEMINI_API_KEY to .env.local and restart the server.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: user,
    config: {
      systemInstruction: system,
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  });

  if (!response.text) {
    throw new LlmError("UPSTREAM", "Gemini returned an empty response.");
  }
  return response.text;
}

async function groqErrorMessage(response: Response): Promise<string> {
  const fallback = "Groq could not complete the request.";
  try {
    const payload: unknown = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string" &&
      payload.error.message.trim()
    ) {
      return payload.error.message.trim().slice(0, 280);
    }
  } catch {
    // The body was not JSON. Keep the generic message.
  }
  return fallback;
}

async function callGroq(system: string, user: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new LlmError("NO_KEY", "GROQ_API_KEY is not set.");
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      // gpt-oss spends tokens on hidden reasoning. Without a higher cap the
      // visible JSON is cut off and Zod reports a missing field such as "items".
      max_completion_tokens: 2500,
      ...(GROQ_MODEL.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${system}\n\nReturn one JSON object and nothing else. No markdown fences.`,
        },
        { role: "user", content: user },
      ],
    }),
  });

  if (response.status === 429) {
    throw new LlmError("RATE_LIMIT", "The free-tier rate limit was hit. Wait a minute and try again.");
  }
  if (!response.ok) {
    const detail = await groqErrorMessage(response);
    console.error("Groq error", response.status, detail);
    throw new LlmError("UPSTREAM", detail);
  }

  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    !("choices" in payload) ||
    !Array.isArray(payload.choices) ||
    !payload.choices[0] ||
    typeof payload.choices[0] !== "object" ||
    !("message" in payload.choices[0]) ||
    !payload.choices[0].message ||
    typeof payload.choices[0].message !== "object" ||
    !("content" in payload.choices[0].message) ||
    typeof payload.choices[0].message.content !== "string"
  ) {
    throw new LlmError("UPSTREAM", "Groq returned an unexpected response.");
  }

  return payload.choices[0].message.content;
}

async function attempt<T>(run: () => Promise<string>, schema: z.ZodType<T>, tries: number): Promise<T> {
  let last = new LlmError("UPSTREAM", "The model request failed.");

  for (let tryIndex = 0; tryIndex < tries; tryIndex += 1) {
    try {
      const text = await run();
      const parsed = schema.safeParse(coerceModelJson(extractJson(text)));
      if (!parsed.success) {
        const reasons = parsed.error.issues
          .slice(0, 4)
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
        console.error("Model JSON failed validation", reasons.join("; "));
        last = new LlmError("INVALID_JSON", "The model returned data in an unexpected shape.");
        continue;
      }
      return parsed.data;
    } catch (error) {
      last = normalize(error);
      // A missing key will not succeed on a second try.
      if (last.code === "NO_KEY") break;
    }
  }

  throw last;
}

export async function generateStructured<T>(options: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  geminiSchema: Schema;
}): Promise<LlmResult<T>> {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  if (!hasGemini && !hasGroq) {
    throw new LlmError(
      "NO_KEY",
      "No AI key is configured. Add GEMINI_API_KEY to .env.local and restart the server.",
    );
  }

  if (hasGemini) {
    try {
      const data = await attempt(
        () => callGemini(options.system, options.user, options.geminiSchema),
        options.schema,
        2,
      );
      return { data, provider: "gemini" };
    } catch (error) {
      if (!hasGroq) throw normalize(error);
    }
  }

  // Gemini already had its retry. If Groq is the only key, give it that same one retry
  // so a single malformed JSON response does not fail the demo.
  const groqTries = hasGemini ? 1 : 2;
  const data = await attempt(() => callGroq(options.system, options.user), options.schema, groqTries);
  return { data, provider: "groq" };
}
