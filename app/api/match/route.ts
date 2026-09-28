import { matchGeminiSchema } from "@/lib/gemini-schemas";
import { errorResponse, HttpError, rateLimit, readJson } from "@/lib/guard";
import { NO_MATCH_MESSAGE, propertyById, shortlistForLead } from "@/lib/inventory";
import { generateStructured } from "@/lib/llm";
import { buildMatchUser, MATCH_SYSTEM } from "@/lib/prompts";
import { leadSchema, matchResponseSchema, matchResultSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Code picks the candidate homes. The model only ranks that shortlist.
 * Any id it invents is dropped before the response leaves the server.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const body = await readJson(request);
    const parsed = zLead(body);
    const candidates = shortlistForLead(parsed);
    if (candidates.length === 0) {
      return Response.json(
        matchResponseSchema.parse({ matches: [], message: NO_MATCH_MESSAGE, provider: null }),
      );
    }

    const result = await generateStructured({
      system: MATCH_SYSTEM,
      user: buildMatchUser(parsed, candidates),
      schema: matchResultSchema,
      geminiSchema: matchGeminiSchema,
    });

    const allowed = new Set(candidates.map((property) => property.id));
    const seen = new Set<string>();
    const matches = result.data.matches.filter((match) => {
      if (!allowed.has(match.propertyId) || seen.has(match.propertyId) || !propertyById(match.propertyId)) {
        return false;
      }
      seen.add(match.propertyId);
      return true;
    });

    return Response.json(
      matchResponseSchema.parse({
        matches,
        message: matches.length === 0 ? NO_MATCH_MESSAGE : null,
        provider: result.provider,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

function zLead(body: unknown) {
  const record = body && typeof body === "object" && "lead" in body ? body.lead : body;
  const parsed = leadSchema.safeParse(record);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION", "This lead could not be matched.");
  }
  return parsed.data;
}
