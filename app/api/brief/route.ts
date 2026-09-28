import { briefGeminiSchema } from "@/lib/gemini-schemas";
import { errorResponse, HttpError, rateLimit, readJson } from "@/lib/guard";
import { generateStructured } from "@/lib/llm";
import { BRIEF_SYSTEM, buildBriefUser } from "@/lib/prompts";
import { briefRequestSchema, briefResponseSchema, briefResultSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 30-second cheat sheet: opener, three points, objections, and the ask. */
export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const body = await readJson(request);
    const parsed = briefRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION", "This lead could not be prepared.");
    }

    const result = await generateStructured({
      system: BRIEF_SYSTEM,
      user: buildBriefUser(parsed.data.lead),
      schema: briefResultSchema,
      geminiSchema: briefGeminiSchema,
    });

    return Response.json(
      briefResponseSchema.parse({
        opener: result.data.opener,
        talkingPoints: result.data.talkingPoints.slice(0, 3),
        objections: result.data.objections,
        ask: result.data.ask,
        provider: result.provider,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
