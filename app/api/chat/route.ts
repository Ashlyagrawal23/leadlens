import { chatGeminiSchema } from "@/lib/gemini-schemas";
import { errorResponse, HttpError, providerPreference, rateLimit, readJson } from "@/lib/guard";
import { generateStructured } from "@/lib/llm";
import { buildChatUser, CHAT_SYSTEM } from "@/lib/prompts";
import { chatRequestSchema, chatResponseSchema, chatResultSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Answers one salesperson question with this lead's record injected into
 * the prompt. History is capped in buildChatUser so a long thread cannot
 * blow the free-tier context window.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  try {
    const body = await readJson(request);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "VALIDATION",
        parsed.error.issues[0]?.message ?? "That question could not be sent.",
      );
    }

    const { lead, question } = parsed.data;
    const result = await generateStructured({
      preference: providerPreference(request),
      system: CHAT_SYSTEM,
      user: buildChatUser(
        lead,
        lead.chat.map((message) => ({ role: message.role, content: message.content })),
        question,
      ),
      schema: chatResultSchema,
      geminiSchema: chatGeminiSchema,
    });

    const rewritten = result.data.rewrittenMessage?.trim() ?? "";

    return Response.json(
      chatResponseSchema.parse({
        reply: result.data.reply,
        rewrittenMessage: rewritten.length > 0 ? rewritten : null,
        provider: result.provider,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
