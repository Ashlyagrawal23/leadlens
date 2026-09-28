import type { z } from "zod";

/** Browser helper for the AI routes. The API key never reaches this file. */

export type ProviderChoice = "auto" | "gemini" | "groq";

const PROVIDER_KEY = "leadlens.provider";
/** Fired after every AI call so the nav can refresh provider health. */
export const AI_CALL_EVENT = "leadlens:ai-call";

export function readProviderChoice(): ProviderChoice {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(PROVIDER_KEY);
  return stored === "gemini" || stored === "groq" ? stored : "auto";
}

const PROVIDER_EVENT = "leadlens:provider";

export function saveProviderChoice(choice: ProviderChoice): void {
  window.localStorage.setItem(PROVIDER_KEY, choice);
  window.dispatchEvent(new Event(PROVIDER_EVENT));
}

/** For useSyncExternalStore: fires when this tab or another tab changes the choice. */
export function subscribeProviderChoice(onChange: () => void): () => void {
  window.addEventListener(PROVIDER_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PROVIDER_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function messageFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("message" in payload)) return null;
  return typeof payload.message === "string" ? payload.message : null;
}

export async function postJson<T>(url: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-llm-provider": readProviderChoice() },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }

  const payload: unknown = await response.json().catch(() => null);
  window.dispatchEvent(new Event(AI_CALL_EVENT));
  if (!response.ok) {
    throw new Error(messageFrom(payload) ?? "Something went wrong. Please try again.");
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("The server returned an unexpected response.");
  }
  return parsed.data;
}
