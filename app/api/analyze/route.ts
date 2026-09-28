import { analysisGeminiSchema } from "@/lib/gemini-schemas";
import { errorResponse, HttpError, providerPreference, rateLimit, readJson } from "@/lib/guard";
import { finalizeAnalysis } from "@/lib/leads";
import { generateStructured } from "@/lib/llm";
import { ANALYSIS_SYSTEM, buildAnalyzeUser } from "@/lib/prompts";
import { analysisSchema, analyzeResponseSchema, intakeSchema, modelAnalysisSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Turns an intake form into a scored analysis.
 * The browser saves the lead only after this succeeds, so the list never
 * shows a card from a failed request.
 *
 * The model returns five factor scores. finalizeAnalysis adds them, clamps
 * the total to 0–100, and sets hot / warm / cold. A hardOverride, if the
 * model set one, replaces only the badge.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const body = await readJson(request);
    const context = readContext(body);
    const parsed = intakeSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message;
      throw new HttpError(
        400,
        "VALIDATION",
        !issue || issue === "Required" ? "Check the form and try again." : issue,
      );
    }

    const result = await generateStructured({
      preference: providerPreference(request),
      system: ANALYSIS_SYSTEM,
      user: buildAnalyzeUser(parsed.data, context),
      schema: modelAnalysisSchema,
      geminiSchema: analysisGeminiSchema,
    });

    const analysis = analysisSchema.parse(
      finalizeAnalysis({
        ...result.data,
        hardOverride: result.data.hardOverride ?? null,
        hardOverrideReason: result.data.hardOverrideReason?.trim() || null,
      }),
    );

    return Response.json(analyzeResponseSchema.parse({ analysis, provider: result.provider }));
  } catch (error) {
    return errorResponse(error);
  }
}

function readContext(body: unknown): string {
  if (!body || typeof body !== "object" || !("context" in body)) return "";
  const context = body.context;
  return typeof context === "string" ? context.slice(0, 6000) : "";
}
