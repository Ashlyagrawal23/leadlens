import { leadListSchema, leadSchema } from "@/lib/schemas";
import type { Lead } from "@/lib/types";

/**
 * JSON backup and restore for the leads in this browser.
 *
 * localStorage is the only copy of the pipeline, so clearing site data or
 * switching laptops loses it. A backup file is the no-server answer.
 */

const FORMAT = "leadlens-backup";
const VERSION = 1;
/** leadListSchema caps storage at 100 leads. */
export const MAX_LEADS = 100;

export function makeBackup(leads: Lead[], now = new Date()): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: now.toISOString(), leads }, null, 2);
}

export interface RestorePreview {
  leads: Lead[];
  added: number;
  updated: number;
  unchanged: number;
  /** Rows in the file that failed validation and were skipped. */
  skipped: number;
  /** Oldest leads dropped to stay under MAX_LEADS. */
  dropped: number;
}

/**
 * Accepts a LeadLens backup, or a bare array of leads. Bad rows are skipped
 * one by one, so a single broken lead does not throw away the whole file.
 */
export function parseBackup(text: string): { leads: Lead[]; skipped: number } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && "format" in raw && raw.format === FORMAT && "leads" in raw
      ? raw.leads
      : null;
  if (!Array.isArray(rows)) throw new Error("That file is not a LeadLens backup.");

  const leads: Lead[] = [];
  let skipped = 0;
  for (const row of rows) {
    const parsed = leadSchema.safeParse(row);
    if (parsed.success) leads.push(parsed.data);
    else skipped += 1;
  }
  if (leads.length === 0) throw new Error("The backup has no leads this version can read.");
  return { leads, skipped };
}

/**
 * Merge by id. When both sides have a lead, the one edited most recently
 * wins, so restoring an old backup never overwrites newer notes.
 */
export function mergeLeads(current: Lead[], incoming: Lead[], skipped = 0): RestorePreview {
  const byId = new Map(current.map((lead) => [lead.id, lead]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const lead of incoming) {
    const existing = byId.get(lead.id);
    if (!existing) {
      byId.set(lead.id, lead);
      added += 1;
    } else if (lead.updatedAt > existing.updatedAt) {
      byId.set(lead.id, lead);
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  const all = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const leads = leadListSchema.parse(all.slice(0, MAX_LEADS));
  return { leads, added, updated, unchanged, skipped, dropped: Math.max(0, all.length - MAX_LEADS) };
}
