"use client";

import { useState } from "react";
import { ErrorBanner, primaryButton } from "@/components/ui";
import { WhatsAppComposer } from "@/components/WhatsAppComposer";
import { postJson } from "@/lib/client";
import { newId } from "@/lib/leads";
import { chatResponseSchema } from "@/lib/schemas";
import { updateLead } from "@/lib/storage";
import type { ChatMessage, Lead } from "@/lib/types";

const CHIPS = [
  {
    label: "Prep me for the call",
    question: "What should I emphasize on the call? Give me a tight talk track.",
  },
  {
    label: "Make reply more assertive",
    question: "Rewrite the suggested response so it is more assertive, still polite, and ready to send.",
  },
  {
    label: "Make it shorter",
    question: "Rewrite the suggested response so it is shorter and ready for WhatsApp.",
  },
  {
    label: "Reply in Hinglish",
    question: "Rewrite the suggested response in Hinglish, short enough for WhatsApp.",
  },
  {
    label: "Handle price objection",
    question: "The customer is pushing on price. How should I handle it using only facts from this lead?",
  },
];

export function ChatPanel({ lead }: { lead: Lead }) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    setPending(text);
    setError(null);
    try {
      const result = await postJson("/api/chat", { lead, question: text }, chatResponseSchema);
      const now = new Date().toISOString();
      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
        rewrittenMessage: null,
        createdAt: now,
      };
      const assistantMessage: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: result.reply,
        rewrittenMessage: result.rewrittenMessage,
        createdAt: now,
      };
      updateLead(lead.id, { chat: [...lead.chat, userMessage, assistantMessage].slice(-40) });
      if (text === draft.trim()) setDraft("");
    } catch (caught) {
      setDraft(text);
      setError(caught instanceof Error ? caught.message : "The assistant could not answer. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="flex max-h-[40rem] flex-col rounded-2xl border border-line bg-card shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)]">
      <header className="border-b border-line px-4 py-3">
        <h2 className="font-semibold">Ask about {lead.name}</h2>
        <p className="text-sm text-muted">Answers use this lead only, not a generic script.</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {lead.chat.length === 0 && !pending ? (
          <p className="text-sm text-muted">Try a chip, or ask what to emphasize on the call.</p>
        ) : null}
        {lead.chat.map((message) => (
          <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[95%] rounded-2xl px-3 py-2 text-left text-sm whitespace-pre-wrap ${
                message.role === "user" ? "bg-brand text-white" : "bg-stone-100 text-ink"
              }`}
            >
              {message.content}
            </div>
            {message.rewrittenMessage ? (
              <div className="mt-2 rounded-xl border border-brand/30 bg-emerald-50 p-3 text-left text-sm">
                <p className="mb-2 text-xs font-semibold tracking-wide text-brand-dark uppercase">Ready to send</p>
                <WhatsAppComposer
                  key={message.rewrittenMessage}
                  initialText={message.rewrittenMessage}
                  phoneRaw={lead.phone}
                />
              </div>
            ) : null}
          </div>
        ))}
        {pending ? (
          <div className="space-y-2">
            <div className="text-right">
              <div className="inline-block rounded-2xl bg-brand px-3 py-2 text-sm text-white">{pending}</div>
            </div>
            <p className="animate-pulse text-sm text-muted">Thinking…</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-line p-3">
        {error ? <ErrorBanner message={error} /> : null}
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={Boolean(pending)}
              onClick={() => void send(chip.question)}
              className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-stone-200 disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            value={draft}
            placeholder="Ask about this lead"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className={primaryButton} disabled={Boolean(pending) || draft.trim() === ""}>
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
