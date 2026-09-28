import { providerStatus } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which providers have keys, and which one is cooling down after a rate limit. Never returns a key. */
export function GET() {
  return Response.json({ providers: providerStatus() });
}
