import { planGeminiSchema } from "@/lib/gemini-schemas";
import { errorResponse, HttpError, rateLimit, readJson } from "@/lib/guard";
import { isClosed } from "@/lib/leads";
import { generateStructured, LlmError } from "@/lib/llm";
import { buildPlanUser, PLAN_SYSTEM } from "@/lib/prompts";
import { planRequestSchema, planResponseSchema, planResultSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Builds a one-day call list from the leads currently stored in the browser.
 * Won and lost leads are dropped here, and any id the model invents is
 * dropped after the response. The UI still has a rule-based queue if this fails.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const body = await readJson(request);
    const parsed = planRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION", "The lead list could not be planned.");
    }

    const active = parsed.data.leads.filter((lead) => !isClosed(lead));
    if (active.length === 0) {
      throw new HttpError(400, "VALIDATION", "There are no open leads to plan. Won and lost leads are skipped.");
    }

    const result = await generateStructured({
      system: PLAN_SYSTEM,
      user: buildPlanUser(active),
      schema: planResultSchema,
      geminiSchema: planGeminiSchema,
    });

    const allowed = new Set(active.map((lead) => lead.id));
    const seen = new Set<string>();
    const items = result.data.items.filter((item) => {
      if (!allowed.has(item.leadId) || seen.has(item.leadId)) return false;
      seen.add(item.leadId);
      return true;
    });

    if (items.length === 0) {
      throw new LlmError("INVALID_JSON", "The plan did not refer to your leads. Please try again.");
    }

    return Response.json(
      planResponseSchema.parse({
        focus: result.data.focus,
        items,
        provider: result.provider,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
