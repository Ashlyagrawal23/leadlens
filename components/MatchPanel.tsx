"use client";

import { useState } from "react";
import { WhatsAppComposer } from "@/components/WhatsAppComposer";
import { ErrorBanner, secondaryButton } from "@/components/ui";
import { postJson } from "@/lib/client";
import { formatInr, propertyById } from "@/lib/inventory";
import { matchResponseSchema, pitchResponseSchema } from "@/lib/schemas";
import { updateLead } from "@/lib/storage";
import type { Lead } from "@/lib/types";

export function MatchPanel({ lead }: { lead: Lead }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pitchFor, setPitchFor] = useState<string | null>(null);
  const [pitchText, setPitchText] = useState<string | null>(null);
  const [pitchLoading, setPitchLoading] = useState(false);

  async function findMatches() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await postJson("/api/match", { lead }, matchResponseSchema);
      updateLead(lead.id, { matches: result.matches });
      setNotice(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Matching failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function pitch(propertyId: string) {
    setPitchFor(propertyId);
    setPitchText(null);
    setPitchLoading(true);
    setError(null);
    try {
      const result = await postJson("/api/pitch", { lead, propertyId }, pitchResponseSchema);
      setPitchText(result.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The pitch could not be drafted.");
    } finally {
      setPitchLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Best matches</h2>
        <button type="button" className={secondaryButton} disabled={loading} onClick={() => void findMatches()}>
          {loading ? "Matching…" : lead.matches.length > 0 ? "Refresh matches" : "Find matches"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Homes are filtered in code by city and budget, then ranked.</p>
      {error ? (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      ) : null}
      {notice ? <p className="mt-3 text-sm text-amber-900">{notice}</p> : null}
      <ul className="mt-3 space-y-3">
        {lead.matches.map((match) => {
          const property = propertyById(match.propertyId);
          if (!property) return null;
          return (
            <li key={match.propertyId} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{property.title}</h3>
                <span className="text-sm font-semibold text-brand">{match.matchScore}</span>
              </div>
              <p className="text-sm text-muted">
                {property.locality} · {property.type} · {formatInr(property.priceInr)} · {property.possessionStatus}
              </p>
              <p className="mt-2 text-sm">{match.whyItFits}</p>
              <p className="mt-1 text-sm text-muted">Concern: {match.possibleConcern}</p>
              <button
                type="button"
                className={`${secondaryButton} mt-3`}
                disabled={pitchLoading && pitchFor === match.propertyId}
                onClick={() => void pitch(match.propertyId)}
              >
                {pitchLoading && pitchFor === match.propertyId ? "Drafting…" : "Pitch this on WhatsApp"}
              </button>
              {pitchFor === match.propertyId && pitchText ? (
                <div className="mt-3">
                  <WhatsAppComposer key={pitchText} initialText={pitchText} phoneRaw={lead.phone} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
