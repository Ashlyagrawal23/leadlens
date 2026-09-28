import type { z } from "zod";

/** Browser helper for the five AI routes. The API key never reaches this file. */

function messageFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("message" in payload)) return null;
  return typeof payload.message === "string" ? payload.message : null;
}

export async function postJson<T>(url: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(messageFrom(payload) ?? "Something went wrong. Please try again.");
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("The server returned an unexpected response.");
  }
  return parsed.data;
}
