"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { ErrorBanner, fieldClass, primaryButton, secondaryButton } from "@/components/ui";
import { postJson } from "@/lib/client";
import { newId } from "@/lib/leads";
import { logCallResponseSchema } from "@/lib/schemas";
import { updateLead } from "@/lib/storage";
import { STATUSES, type CallInsight, type Lead, type LeadStatus, type Sentiment } from "@/lib/types";

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function subscribeSpeech() {
  return () => {};
}

function speechSupported(): boolean {
  return recognitionCtor() !== null;
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function toDateInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromDateInput(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1, 18, 0, 0, 0);
  return date.toISOString();
}

export function VoiceCall({ lead }: { lead: Lead }) {
  const recognition = useRef<InstanceType<RecognitionCtor> | null>(null);
  const prefix = useRef("");
  const supported = useSyncExternalStore(subscribeSpeech, speechSupported, () => false);
  const [lang, setLang] = useState<"en-IN" | "hi-IN">("en-IN");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<CallInsight | null>(null);

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError(null);
    prefix.current = transcript.trim();
    const session = new Ctor();
    session.lang = lang;
    session.interimResults = true;
    session.continuous = true;
    session.onresult = (event) => {
      let spoken = "";
      for (let index = 0; index < event.results.length; index += 1) {
        spoken += event.results[index][0]?.transcript ?? "";
      }
      const base = prefix.current;
      setTranscript(base ? `${base} ${spoken}`.trim() : spoken.trim());
    };
    session.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission was denied. You can still type the note.");
      } else if (event.error === "no-speech") {
        setError("No speech heard. Try again, or type the note.");
      } else if (event.error !== "aborted") {
        setError("Voice input stopped. You can type the rest of the note.");
      }
      setListening(false);
    };
    session.onend = () => setListening(false);
    recognition.current = session;
    try {
      session.start();
      setListening(true);
    } catch {
      setError("The microphone could not start. Type the note instead.");
    }
  }

  function stop() {
    recognition.current?.stop();
    setListening(false);
  }

  async function structureNote() {
    const text = transcript.trim();
    if (!text) {
      setError("Add a note before saving.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await postJson("/api/logcall", { lead, transcript: text }, logCallResponseSchema);
      setDraft(result.insight);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The call note could not be structured.");
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    if (!draft) return;
    const now = new Date().toISOString();
    const objections = draft.newObjections.map((item) => item.trim()).filter(Boolean);
    const commitments = draft.commitments.map((item) => item.trim()).filter(Boolean);
    updateLead(lead.id, {
      status: draft.statusSuggestion,
      lastContactedAt: now,
      followUpDueAt: draft.suggestedFollowUpDate,
      analysis: lead.analysis
        ? {
            ...lead.analysis,
            objections: [...lead.analysis.objections, ...objections].slice(0, 8),
            nextAction: draft.suggestedNextAction,
          }
        : lead.analysis,
      contactLogs: [
        ...lead.contactLogs,
        { id: newId(), channel: "call", notes: draft.callSummary, contactedAt: now },
      ],
      callNotes: [
        ...lead.callNotes,
        {
          id: newId(),
          transcript: transcript.trim(),
          contactedAt: now,
          result: { ...draft, newObjections: objections, commitments },
        },
      ],
    });
    setDraft(null);
    setTranscript("");
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Log call by voice</h2>
        {supported ? (
          <div className="flex gap-2 text-xs font-semibold">
            <button
              type="button"
              className={lang === "en-IN" ? "rounded-full bg-ink px-2 py-1 text-white" : "rounded-full bg-stone-100 px-2 py-1"}
              onClick={() => setLang("en-IN")}
            >
              en-IN
            </button>
            <button
              type="button"
              className={lang === "hi-IN" ? "rounded-full bg-ink px-2 py-1 text-white" : "rounded-full bg-stone-100 px-2 py-1"}
              onClick={() => setLang("hi-IN")}
            >
              hi-IN
            </button>
          </div>
        ) : null}
      </div>
      {supported ? null : (
        <p className="mt-2 text-sm text-muted">Voice input works in Chrome/Edge. You can still type the note.</p>
      )}
      <label className="mt-3 block text-sm font-semibold">
        Transcript
        <textarea
          className={`${fieldClass} min-h-24`}
          value={transcript}
          placeholder="What did they say on the call?"
          onChange={(event) => setTranscript(event.target.value)}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {supported ? (
          <button type="button" className={secondaryButton} onClick={listening ? stop : start}>
            {listening ? "Stop mic" : "Start mic"}
          </button>
        ) : null}
        <button type="button" className={primaryButton} disabled={loading || transcript.trim() === ""} onClick={() => void structureNote()}>
          {loading ? "Reading the note…" : "Save call note"}
        </button>
      </div>
      {listening ? <p className="mt-2 text-sm text-brand">Listening… words will appear in the box.</p> : null}
      {error ? (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      ) : null}

      {draft ? (
        <div className="mt-4 space-y-3 rounded-xl border border-brand/30 bg-emerald-50 p-3">
          <p className="text-sm font-semibold">Looks right? Save</p>
          <label className="block text-sm font-semibold">
            Summary
            <textarea
              className={`${fieldClass} min-h-16`}
              value={draft.callSummary}
              onChange={(event) => setDraft({ ...draft, callSummary: event.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Sentiment
              <select
                className={fieldClass}
                value={draft.customerSentiment}
                onChange={(event) =>
                  setDraft({ ...draft, customerSentiment: event.target.value as Sentiment })
                }
              >
                <option value="positive">positive</option>
                <option value="neutral">neutral</option>
                <option value="negative">negative</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Suggested status
              <select
                className={fieldClass}
                value={draft.statusSuggestion}
                onChange={(event) => setDraft({ ...draft, statusSuggestion: event.target.value as LeadStatus })}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold">
            New objections (one per line)
            <textarea
              className={`${fieldClass} min-h-16`}
              value={draft.newObjections.join("\n")}
              onChange={(event) => setDraft({ ...draft, newObjections: event.target.value.split("\n") })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Commitments (one per line)
            <textarea
              className={`${fieldClass} min-h-16`}
              value={draft.commitments.join("\n")}
              onChange={(event) => setDraft({ ...draft, commitments: event.target.value.split("\n") })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Follow-up due
            <input
              type="date"
              className={fieldClass}
              value={toDateInput(draft.suggestedFollowUpDate)}
              onChange={(event) =>
                setDraft({ ...draft, suggestedFollowUpDate: fromDateInput(event.target.value) })
              }
            />
          </label>
          <label className="block text-sm font-semibold">
            Next action
            <textarea
              className={`${fieldClass} min-h-16`}
              value={draft.suggestedNextAction}
              onChange={(event) => setDraft({ ...draft, suggestedNextAction: event.target.value })}
            />
          </label>
          <button type="button" className={primaryButton} onClick={confirm}>
            Looks right? Save
          </button>
        </div>
      ) : null}
    </section>
  );
}
