import { pitchGeminiSchema } from "@/lib/gemini-schemas";
import { errorResponse, HttpError, providerPreference, rateLimit, readJson } from "@/lib/guard";
import { propertyById } from "@/lib/inventory";
import { generateStructured } from "@/lib/llm";
import { buildPitchUser, PITCH_SYSTEM } from "@/lib/prompts";
import { leadSchema, pitchResponseSchema } from "@/lib/schemas";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const pitchRequestSchema = z.object({
  lead: leadSchema,
  propertyId: z.string().min(1).max(40),
});

const pitchModelSchema = z.object({
  message: z.string().trim().min(1).max(800),
});

/** One WhatsApp draft about a home that exists in inventory. Unknown ids are rejected. */
export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const body = await readJson(request);
    const parsed = pitchRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION", "This pitch could not be drafted.");
    }
    const property = propertyById(parsed.data.propertyId);
    if (!property) {
      throw new HttpError(400, "VALIDATION", "That home is not in inventory.");
    }

    const result = await generateStructured({
      preference: providerPreference(request),
      system: PITCH_SYSTEM,
      user: buildPitchUser(parsed.data.lead, property),
      schema: pitchModelSchema,
      geminiSchema: pitchGeminiSchema,
    });

    return Response.json(pitchResponseSchema.parse({ message: result.data.message, provider: result.provider }));
  } catch (error) {
    return errorResponse(error);
  }
}
