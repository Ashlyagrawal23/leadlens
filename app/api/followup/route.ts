import { followUpGeminiSchema } from "@/lib/gemini-schemas";
import { errorResponse, HttpError, providerPreference, rateLimit, readJson } from "@/lib/guard";
import { generateStructured } from "@/lib/llm";
import { buildFollowUpUser, FOLLOW_UP_SYSTEM } from "@/lib/prompts";
import {
  followUpRequestSchema,
  followUpResponseSchema,
  followUpResultSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Drafts a channel-specific follow-up from the lead, its status, and the
 * notes the salesperson logged. Email keeps a subject; WhatsApp and SMS do not.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const body = await readJson(request);
    const parsed = followUpRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "VALIDATION", "The follow-up could not be drafted.");
    }

    const { lead, channel } = parsed.data;
    const result = await generateStructured({
      preference: providerPreference(request),
      system: FOLLOW_UP_SYSTEM,
      user: buildFollowUpUser(lead, channel),
      schema: followUpResultSchema,
      geminiSchema: followUpGeminiSchema,
    });

    const subject =
      channel === "email" ? result.data.subject?.trim() || "Following up on your property search" : null;

    return Response.json(
      followUpResponseSchema.parse({
        channel,
        subject,
        message: result.data.message,
        provider: result.provider,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
