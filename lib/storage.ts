import { buildSeedLeads } from "@/lib/seed";
import { leadListSchema } from "@/lib/schemas";
import type { Lead } from "@/lib/types";

/**
 * Browser storage for leads.
 *
 * Components call getLeads, saveLead, updateLead, and deleteLead. They do
 * not touch localStorage themselves. A later Supabase version can keep
 * these function names and move the work to API routes.
 *
 * The React hook uses leadsSnapshot() with useSyncExternalStore. That is
 * the supported way to read a browser store: the server snapshot is empty,
 * then the client snapshot is whatever is saved in this browser.
 */

// v2 adds phone, score breakdown, matches, and call notes.
// v1 rows are left in the browser and ignored, so old shapes cannot crash the page.
const STORAGE_KEY = "leadlens.leads.v2";
const CHANGE_EVENT = "leadlens-change";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readStored(): Lead[] | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed = leadListSchema.safeParse(JSON.parse(raw));
    // Corrupt data is treated as "never seeded" so the app can recover.
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function write(leads: Lead[], notify: boolean): void {
  const parsed = leadListSchema.parse(leads);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  if (notify) window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getLeads(): Lead[] {
  return readStored() ?? [];
}

export function ensureSeeded(): Lead[] {
  const existing = readStored();
  if (existing) return existing;
  const seeded = buildSeedLeads();
  if (!canUseStorage()) return seeded;
  write(seeded, false);
  // Read back the parsed copy so later snapshots match what was saved.
  return readStored() ?? seeded;
}

export function saveLead(lead: Lead): Lead {
  const leads = ensureSeeded().filter((item) => item.id !== lead.id);
  write([lead, ...leads], true);
  return lead;
}

export function updateLead(
  id: string,
  patch: Partial<Omit<Lead, "id" | "createdAt">>,
): Lead | null {
  const leads = ensureSeeded();
  const index = leads.findIndex((lead) => lead.id === id);
  if (index === -1) return null;
  const current = leads[index];
  const next: Lead = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const copy = [...leads];
  copy[index] = next;
  write(copy, true);
  return next;
}

export function deleteLead(id: string): void {
  write(
    ensureSeeded().filter((lead) => lead.id !== id),
    true,
  );
}

/** Used by restore. The caller has already merged and validated the list. */
export function replaceLeads(leads: Lead[]): void {
  write(leads, true);
}

export function resetDemoData(): Lead[] {
  const seeded = buildSeedLeads();
  write(seeded, true);
  return seeded;
}

/** Snapshot string for useSyncExternalStore. Same text means "nothing changed". */
export function leadsSnapshot(): string {
  if (!canUseStorage()) return "[]";
  try {
    ensureSeeded();
    // Return the stored text, not a fresh JSON.stringify of a new object.
    // A new string on every call would make React re-render forever.
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function subscribeLeads(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // The native storage event fires when another tab writes this key.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
