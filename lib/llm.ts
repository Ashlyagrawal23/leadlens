import { ApiError, GoogleGenAI, Type, type Schema } from "@google/genai";
import type { z } from "zod";

/**
 * One wrapper for both model providers.
 *
 * Flow:
 * 1. Pick an order. "auto" and "gemini" try Gemini first; "groq" tries Groq first.
 *    The other provider is always the fallback when its key is set.
 * 2. A provider that just hit its rate limit is skipped until its cooldown ends,
 *    so we do not waste a request (and 20 seconds) on a known 429.
 * 3. Both providers get the same JSON schema: Gemini through responseSchema,
 *    Groq through strict json_schema mode. The output is then parsed, coerced,
 *    auto-repaired for small range/length slips, and validated with Zod.
 * 4. If Zod still rejects it, the retry tells the model exactly which fields
 *    were wrong instead of asking the same question again.
 *
 * Routes never talk to a provider directly, so swapping the model is a
 * change in this file.
 */

// New Gemini keys are rejected for gemini-2.0-flash and gemini-2.5-flash.
// gemini-3.8-flash is the current model those keys are told to use.
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
// The assignment named llama-3.3-70b-versatile. Groq has removed that model.
// gpt-oss-120b is a current free-tier chat model that supports strict JSON schema.
// Override with GROQ_MODEL if Groq renames it again.
const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 22_000;
const DEFAULT_COOLDOWN_MS = 60_000;

export type LlmCode = "NO_KEY" | "RATE_LIMIT" | "TIMEOUT" | "UPSTREAM" | "INVALID_JSON";
export type Provider = "gemini" | "groq";
export type ProviderPreference = "auto" | Provider;
export const PROVIDER_PREFERENCES = ["auto", "gemini", "groq"] as const;

export class LlmError extends Error {
  readonly status: number;

  constructor(
    readonly code: LlmCode,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LlmError";
    this.status =
      code === "NO_KEY" ? 503 : code === "RATE_LIMIT" ? 429 : code === "TIMEOUT" ? 504 : 502;
  }
}

export interface LlmResult<T> {
  data: T;
  provider: Provider;
}

export interface ProviderStatus {
  provider: Provider;
  model: string;
  configured: boolean;
  coolingDownUntil: string | null;
  lastError: string | null;
  lastSuccessAt: string | null;
}

/**
 * In-memory health per provider. Like the rate limiter in guard.ts, each
 * server instance keeps its own copy. That is enough to stop hammering a
 * provider that has already said "slow down".
 */
const health: Record<Provider, { cooldownUntil: number; lastError: string | null; lastSuccessAt: number | null }> = {
  gemini: { cooldownUntil: 0, lastError: null, lastSuccessAt: null },
  groq: { cooldownUntil: 0, lastError: null, lastSuccessAt: null },
};

function hasKey(provider: Provider): boolean {
  return Boolean(provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY);
}

export function providerStatus(): ProviderStatus[] {
  const now = Date.now();
  return (["gemini", "groq"] as const).map((provider) => ({
    provider,
    model: provider === "gemini" ? GEMINI_MODEL : GROQ_MODEL,
    configured: hasKey(provider),
    coolingDownUntil:
      health[provider].cooldownUntil > now ? new Date(health[provider].cooldownUntil).toISOString() : null,
    lastError: health[provider].lastError,
    lastSuccessAt: health[provider].lastSuccessAt
      ? new Date(health[provider].lastSuccessAt).toISOString()
      : null,
  }));
}

const SCORE_FACTOR_KEYS = [
  "budgetClarity",
  "timelineUrgency",
  "requirementSpecificity",
  "engagementSignals",
  "redFlagsPenalty",
] as const;

const TRUNCATED_ARRAY_KEYS = ["keyRequirements", "objections", "talkingPoints"] as const;

/**
 * Groq sometimes returns "12 - budget mentioned" or just a reason string
 * instead of { points, reason }. finalizeAnalysis still clamps the points.
 */
function coerceScoreFactor(value: unknown, defaultPoints: number): { points: number; reason: string } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const reason =
      typeof obj.reason === "string" && obj.reason.trim() ? obj.reason.trim() : "not mentioned";
    if (typeof obj.points === "number") {
      return { points: Math.round(obj.points), reason };
    }
    if (typeof obj.points === "string" && obj.points.trim() !== "") {
      const parsed = Number(obj.points);
      if (!Number.isNaN(parsed)) return { points: Math.round(parsed), reason };
    }
    return { points: defaultPoints, reason };
  }
  if (typeof value === "number") {
    return { points: Math.round(value), reason: "not mentioned" };
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const labeled = trimmed.match(/^(-?\d+)\s*[-:–—]\s*(.+)$/);
    if (labeled) {
      return { points: Number(labeled[1]), reason: labeled[2].trim() };
    }
    if (/^-?\d+$/.test(trimmed)) {
      return { points: Number(trimmed), reason: "not mentioned" };
    }
    const leading = trimmed.match(/^(-?\d+)\b/);
    if (leading) {
      const rest = trimmed.slice(leading[0].length).replace(/^[\s\-:–—]+/, "").trim();
      if (rest) return { points: Number(leading[1]), reason: rest };
    }
    return { points: defaultPoints, reason: trimmed };
  }
  return { points: defaultPoints, reason: "not mentioned" };
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
    let next = coerceModelJson(child);
    // The rubric says this bucket is a penalty. A model that sends +10 meant -10.
    if (
      key === "redFlagsPenalty" &&
      next &&
      typeof next === "object" &&
      "points" in next &&
      typeof next.points === "number" &&
      next.points > 0
    ) {
      next = { ...next, points: -Math.round(next.points) };
    }
    record[key] = next;
  }

  if (typeof record.score === "number") record.score = Math.round(record.score);
  if (typeof record.score === "string" && record.score.trim() !== "") {
    const parsed = Number(record.score);
    if (!Number.isNaN(parsed)) record.score = Math.round(parsed);
  }
  if (typeof record.priority === "string") record.priority = record.priority.toLowerCase();
  if (typeof record.points === "number") record.points = Math.round(record.points);
  if (typeof record.matchScore === "number") record.matchScore = Math.round(record.matchScore);
  if (record.hardOverride === "" || record.hardOverride === "none") record.hardOverride = null;
  if (typeof record.hardOverride === "string") record.hardOverride = record.hardOverride.toLowerCase();
  if (typeof record.customerSentiment === "string") {
    record.customerSentiment = record.customerSentiment.toLowerCase();
  }
  if (typeof record.channel === "string") record.channel = record.channel.toLowerCase();
  if (record.rewrittenMessage === "") record.rewrittenMessage = null;
  if (record.subject === "") record.subject = null;
  // Groq has no response schema. Follow-up drafts often land in "body" instead of "message".
  if (
    (typeof record.message !== "string" || record.message.trim() === "") &&
    typeof record.body === "string" &&
    record.body.trim()
  ) {
    record.message = record.body;
  }
  if (
    (typeof record.message !== "string" || record.message.trim() === "") &&
    typeof record.text === "string" &&
    record.text.trim()
  ) {
    record.message = record.text;
  }
  for (const key of TRUNCATED_ARRAY_KEYS) {
    if (Array.isArray(record[key])) record[key] = record[key].slice(0, 8);
  }
  if (record.scoreBreakdown && typeof record.scoreBreakdown === "object" && !Array.isArray(record.scoreBreakdown)) {
    const breakdown = record.scoreBreakdown as Record<string, unknown>;
    const coerced: Record<string, unknown> = {};
    for (const key of SCORE_FACTOR_KEYS) {
      coerced[key] = coerceScoreFactor(breakdown[key], 0);
    }
    record.scoreBreakdown = coerced;
  }
  return record;
}

/** Accepts plain JSON, a ```json fence, or JSON wrapped in a sentence of prose. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], trimmed];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(trimmed.slice(start, end + 1));

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next candidate.
    }
  }
  throw new LlmError("INVALID_JSON", "The model did not return valid JSON.");
}

/**
 * Fixes the slips Zod reports that have one obvious answer: an array with
 * nine items when the limit is eight, a reason that is ten characters too
 * long, or 27 points in a 0 to 25 bucket. Missing fields and wrong types are
 * left alone so the retry can ask the model for them.
 */
function repairFromIssues(value: unknown, issues: z.ZodIssue[]): boolean {
  let changed = false;
  for (const issue of issues) {
    if (issue.code !== "too_big" && issue.code !== "too_small") continue;
    if (issue.path.length === 0) continue;

    let parent: unknown = value;
    for (const key of issue.path.slice(0, -1)) {
      if (!parent || typeof parent !== "object") break;
      parent = (parent as Record<string | number, unknown>)[key];
    }
    if (!parent || typeof parent !== "object") continue;

    const container = parent as Record<string | number, unknown>;
    const key = issue.path[issue.path.length - 1];
    const current = container[key];
    const limit = Number(issue.code === "too_big" ? issue.maximum : issue.minimum);
    if (!Number.isFinite(limit)) continue;

    if (issue.code === "too_big" && issue.type === "array" && Array.isArray(current)) {
      container[key] = current.slice(0, limit);
      changed = true;
    } else if (issue.code === "too_big" && issue.type === "string" && typeof current === "string") {
      const cut = current.slice(0, limit);
      const lastSpace = cut.lastIndexOf(" ");
      container[key] = (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
      changed = true;
    } else if (issue.type === "number" && typeof current === "number") {
      container[key] = issue.code === "too_big" ? Math.min(current, limit) : Math.max(current, limit);
      changed = true;
    }
  }
  return changed;
}

function describeIssues(issues: z.ZodIssue[]): string {
  return issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

/**
 * Converts a Gemini responseSchema into the JSON Schema that Groq strict mode
 * expects. Strict mode needs every property listed in "required" and
 * additionalProperties set to false, and it expresses nullable as a type union.
 */
function toJsonSchema(schema: Schema): Record<string, unknown> {
  const typeName: Record<string, string> = {
    [Type.OBJECT]: "object",
    [Type.ARRAY]: "array",
    [Type.STRING]: "string",
    [Type.INTEGER]: "integer",
    [Type.NUMBER]: "number",
    [Type.BOOLEAN]: "boolean",
  };
  const base = typeName[schema.type ?? Type.STRING] ?? "string";
  const out: Record<string, unknown> = { type: schema.nullable ? [base, "null"] : base };

  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.nullable ? [...schema.enum, null] : [...schema.enum];
  if (schema.items) out.items = toJsonSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, child]) => [key, toJsonSchema(child)]),
    );
    out.required = Object.keys(schema.properties);
    out.additionalProperties = false;
  }
  return out;
}

function parseRetryAfter(text: string): number | undefined {
  const match = text.match(/retry in ([\d.]+)\s*s/i) ?? text.match(/try again in ([\d.]+)\s*s/i);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : undefined;
}

function normalize(error: unknown): LlmError {
  if (error instanceof LlmError) return error;
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new LlmError(
        "RATE_LIMIT",
        "The free-tier rate limit was hit. Wait a minute and try again.",
        parseRetryAfter(error.message),
      );
    }
    if (error.status === 401 || error.status === 403) {
      return new LlmError(
        "UPSTREAM",
        "The AI provider rejected the API key. Check the server environment variables.",
      );
    }
    if (error.status === 404) {
      return new LlmError("UPSTREAM", `The model ${GEMINI_MODEL} was not found. Check GEMINI_MODEL.`);
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
      // Thinking tokens share this budget. 2048 sometimes cut the JSON off mid-object.
      maxOutputTokens: 4096,
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

// Flips to false if this Groq model rejects json_schema, so later calls skip straight to json_object.
let groqSupportsSchema = true;

async function callGroq(system: string, user: string, geminiSchema: Schema): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new LlmError("NO_KEY", "GROQ_API_KEY is not set.");
  }

  const send = (useSchema: boolean) =>
    fetch(GROQ_URL, {
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
        max_completion_tokens: 3000,
        ...(GROQ_MODEL.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
        response_format: useSchema
          ? {
              type: "json_schema",
              json_schema: { name: "response", strict: true, schema: toJsonSchema(geminiSchema) },
            }
          : { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${system}\n\nReturn one JSON object and nothing else. No markdown fences.`,
          },
          { role: "user", content: user },
        ],
      }),
    });

  let response = await send(groqSupportsSchema);
  if (response.status === 400 && groqSupportsSchema) {
    const detail = await groqErrorMessage(response);
    if (/json_schema|response_format|schema/i.test(detail)) {
      console.error("Groq rejected json_schema, falling back to json_object:", detail);
      groqSupportsSchema = false;
      response = await send(false);
    } else {
      throw new LlmError("UPSTREAM", detail);
    }
  }

  if (response.status === 429) {
    const retryHeader = Number(response.headers.get("retry-after"));
    throw new LlmError(
      "RATE_LIMIT",
      "The free-tier rate limit was hit. Wait a minute and try again.",
      Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader * 1000 : undefined,
    );
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

/** Parse, coerce, repair, validate. Returns the Zod issues when the shape is still wrong. */
function validate<T>(text: string, schema: z.ZodType<T>): { data: T } | { issues: z.ZodIssue[] } {
  const value = coerceModelJson(extractJson(text));
  const first = schema.safeParse(value);
  if (first.success) return { data: first.data };
  if (repairFromIssues(value, first.error.issues)) {
    const second = schema.safeParse(value);
    if (second.success) return { data: second.data };
    return { issues: second.error.issues };
  }
  return { issues: first.error.issues };
}

async function attempt<T>(
  provider: Provider,
  options: { system: string; user: string; schema: z.ZodType<T>; geminiSchema: Schema },
  tries: number,
): Promise<T> {
  let last = new LlmError("UPSTREAM", "The model request failed.");
  let feedback = "";

  for (let tryIndex = 0; tryIndex < tries; tryIndex += 1) {
    const user = feedback
      ? `${options.user}\n\nYour previous reply was rejected because: ${feedback}. Return the full JSON object again with those fields fixed.`
      : options.user;
    try {
      const text =
        provider === "gemini"
          ? await callGemini(options.system, user, options.geminiSchema)
          : await callGroq(options.system, user, options.geminiSchema);
      const result = validate(text, options.schema);
      if ("data" in result) return result.data;

      feedback = describeIssues(result.issues);
      console.error(`${provider} JSON failed validation:`, feedback);
      last = new LlmError("INVALID_JSON", "The model returned data in an unexpected shape.");
    } catch (error) {
      last = normalize(error);
      if (last.code === "INVALID_JSON") feedback = "the reply was not valid JSON";
      // A missing key or a rate limit will not succeed on an immediate second try.
      if (last.code === "NO_KEY" || last.code === "RATE_LIMIT") break;
    }
  }

  throw last;
}

function providerOrder(preference: ProviderPreference): Provider[] {
  const preferred: Provider[] = preference === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];
  const configured = preferred.filter(hasKey);
  const now = Date.now();
  const ready = configured.filter((provider) => health[provider].cooldownUntil <= now);
  const cooling = configured.filter((provider) => health[provider].cooldownUntil > now);
  // A cooling provider is still tried last, in case its cooldown guess was too long.
  return [...ready, ...cooling];
}

export async function generateStructured<T>(options: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  geminiSchema: Schema;
  preference?: ProviderPreference;
}): Promise<LlmResult<T>> {
  const order = providerOrder(options.preference ?? "auto");

  if (order.length === 0) {
    throw new LlmError(
      "NO_KEY",
      "No AI key is configured. Add GEMINI_API_KEY or GROQ_API_KEY to .env.local and restart the server.",
    );
  }

  const failures: string[] = [];
  let last: LlmError | null = null;

  for (const [index, provider] of order.entries()) {
    // The only provider gets two tries. With a fallback, the first gets two and the fallback one.
    const tries = order.length === 1 || index === 0 ? 2 : 1;
    try {
      const data = await attempt(provider, options, tries);
      health[provider].lastError = null;
      health[provider].lastSuccessAt = Date.now();
      health[provider].cooldownUntil = 0;
      return { data, provider };
    } catch (error) {
      last = normalize(error);
      health[provider].lastError = `${last.code}: ${last.message}`;
      if (last.code === "RATE_LIMIT") {
        health[provider].cooldownUntil = Date.now() + (last.retryAfterMs ?? DEFAULT_COOLDOWN_MS);
      }
      failures.push(`${provider === "gemini" ? "Gemini" : "Groq"} (${last.code})`);
      console.error(`${provider} failed:`, last.code, last.message);
    }
  }

  if (last && order.length > 1) {
    throw new LlmError(last.code, `${last.message} Tried ${failures.join(", then ")}.`, last.retryAfterMs);
  }
  throw last ?? new LlmError("UPSTREAM", "The model request failed.");
}
