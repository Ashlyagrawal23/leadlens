import { logCallGeminiSchema } from "@/lib/gemini-schemas";
import { errorResponse, HttpError, rateLimit, readJson } from "@/lib/guard";
import { generateStructured } from "@/lib/llm";
import { buildLogCallUser, LOG_CALL_SYSTEM } from "@/lib/prompts";
import { callInsightSchema, leadSchema, logCallResponseSchema } from "@/lib/schemas";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const logCallRequestSchema = z.object({
  lead: leadSchema,
  transcript: z.string().trim().min(1, "Add a note before saving").max(2000),
});

/**
 * Structures a call note. The route does not write storage.
 * The browser shows the result and saves only after the salesperson confirms.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const body = await readJson(request);
    const parsed = logCallRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "The call note could not be read.",
      );
    }

    const result = await generateStructured({
      system: LOG_CALL_SYSTEM,
      user: buildLogCallUser(parsed.data.lead, parsed.data.transcript, new Date().toISOString()),
      schema: callInsightSchema,
      geminiSchema: logCallGeminiSchema,
    });

    return Response.json(logCallResponseSchema.parse({ insight: result.data, provider: result.provider }));
  } catch (error) {
    return errorResponse(error);
  }
}
