import { analysisGeminiSchema } from "@/lib/gemini-schemas";
import { errorResponse, HttpError, rateLimit, readJson } from "@/lib/guard";
import { priorityFromScore } from "@/lib/leads";
import { generateStructured } from "@/lib/llm";
import { ANALYSIS_SYSTEM, buildAnalyzeUser } from "@/lib/prompts";
import { analysisSchema, analyzeResponseSchema, intakeSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Turns an intake form into a scored analysis.
 * The browser saves the lead only after this succeeds, so the list never
 * shows a card from a failed request.
 *
 * priorityFromScore overwrites the model's priority label so the badge
 * always matches the rubric (hot at 75+, warm at 45+, otherwise cold).
 */
export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const body = await readJson(request);
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
      system: ANALYSIS_SYSTEM,
      user: buildAnalyzeUser(parsed.data),
      schema: analysisSchema,
      geminiSchema: analysisGeminiSchema,
    });

    const analysis = {
      ...result.data,
      priority: priorityFromScore(result.data.score),
      scoreReasoning: result.data.scoreReasoning.slice(0, 2),
    };

    return Response.json(analyzeResponseSchema.parse({ analysis, provider: result.provider }));
  } catch (error) {
    return errorResponse(error);
  }
}
