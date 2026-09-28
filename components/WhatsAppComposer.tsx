"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui";
import { normalizePhone, whatsAppUrl } from "@/lib/phone";

/**
 * Editable message plus Copy and Send on WhatsApp.
 * The textarea is the source of truth, so a tweak is what gets sent.
 */
export function WhatsAppComposer({
  initialText,
  phoneRaw,
}: {
  initialText: string;
  phoneRaw: string;
}) {
  const [text, setText] = useState(initialText);
  const phone = normalizePhone(phoneRaw);

  return (
    <div className="space-y-2">
      <textarea
        className="min-h-28 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={text} />
        <span title={phone ? undefined : "Add a phone number to enable WhatsApp"} className="inline-flex">
          <button
            type="button"
            disabled={!phone || text.trim() === ""}
            className="rounded-lg bg-[#128C7E] px-2.5 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              if (!phone) return;
              window.open(whatsAppUrl(phone, text), "_blank", "noopener,noreferrer");
            }}
          >
            Send on WhatsApp
          </button>
        </span>
        {phone ? null : <span className="text-xs text-muted">Add a phone number to enable WhatsApp</span>}
      </div>
    </div>
  );
}
