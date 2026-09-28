"use client";

import { useSyncExternalStore } from "react";
import { leadListSchema } from "@/lib/schemas";
import { leadsSnapshot, subscribeLeads } from "@/lib/storage";
import type { Lead } from "@/lib/types";

function parseSnapshot(raw: string): Lead[] | null {
  // The server snapshot is an empty string. Null means "still hydrating",
  // which is different from a real empty list ("[]") after the user deletes every lead.
  if (!raw) return null;
  try {
    const parsed = leadListSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function useLeads(): Lead[] | null {
  const raw = useSyncExternalStore(subscribeLeads, leadsSnapshot, () => "");
  return parseSnapshot(raw);
}
