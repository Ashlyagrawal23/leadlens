"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AI_CALL_EVENT,
  readProviderChoice,
  saveProviderChoice,
  subscribeProviderChoice,
  type ProviderChoice,
} from "@/lib/client";

interface Status {
  provider: "gemini" | "groq";
  model: string;
  configured: boolean;
  coolingDownUntil: string | null;
  lastError: string | null;
}

const OPTIONS: { value: ProviderChoice; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Gemini first, Groq if Gemini fails" },
  { value: "gemini", label: "Gemini", hint: "Gemini first, Groq as backup" },
  { value: "groq", label: "Groq", hint: "Groq first, Gemini as backup" },
];

function describe(status: Status | undefined): { dot: string; text: string } {
  if (!status || !status.configured) return { dot: "bg-stone-300", text: "no key" };
  if (status.coolingDownUntil) {
    const seconds = Math.max(0, Math.round((Date.parse(status.coolingDownUntil) - Date.now()) / 1000));
    return { dot: "bg-amber-500", text: `rate-limited, retry in ${seconds}s` };
  }
  if (status.lastError) return { dot: "bg-rose-500", text: status.lastError };
  return { dot: "bg-emerald-500", text: `ready · ${status.model}` };
}

/** Lets the salesperson pick which AI answers first. The choice lives in localStorage. */
export function ProviderSwitch() {
  const choice = useSyncExternalStore(subscribeProviderChoice, readProviderChoice, () => "auto" as const);
  const [statuses, setStatuses] = useState<Status[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      fetch("/api/providers", { cache: "no-store" })
        .then((response) => response.json() as Promise<{ providers?: Status[] }>)
        .then((payload) => {
          if (alive) setStatuses(payload.providers ?? []);
        })
        // Status is a hint only. The switch still works without it.
        .catch(() => {});
    };
    refresh();
    window.addEventListener(AI_CALL_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(AI_CALL_EVENT, refresh);
    };
  }, []);

  return (
    <div role="radiogroup" aria-label="AI provider" className="flex items-center gap-1 rounded-full border border-line p-0.5">
      {OPTIONS.map((option) => {
        const status = statuses.find((item) => item.provider === option.value);
        const state = option.value === "auto" ? null : describe(status);
        const active = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={state ? `${option.hint}. Status: ${state.text}` : option.hint}
            onClick={() => saveProviderChoice(option.value)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
              active ? "bg-ink text-white" : "text-ink hover:bg-stone-100"
            }`}
          >
            {state && <span aria-hidden className={`h-2 w-2 rounded-full ${state.dot}`} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
