"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ErrorBanner, fieldClass, primaryButton, secondaryButton } from "@/components/ui";
import { postJson } from "@/lib/client";
import { addDaysFromNow, followUpOffsetDays, newId } from "@/lib/leads";
import { SAMPLE_INTAKE } from "@/lib/sample";
import { analyzeResponseSchema, intakeSchema, LIMITS } from "@/lib/schemas";
import { saveLead } from "@/lib/storage";
import { TIMELINES, type Intake, type Lead } from "@/lib/types";

const EMPTY: Intake = {
  name: "",
  location: "",
  propertyRequirement: "",
  budget: "",
  timeline: "Immediate",
  message: "",
  phone: "",
};

type FieldErrors = Partial<Record<keyof Intake, string>>;

function errorsFrom(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const next: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && next[key as keyof Intake] === undefined) {
      next[key as keyof Intake] = issue.message;
    }
  }
  return next;
}

export function LeadForm() {
  const router = useRouter();
  const [values, setValues] = useState<Intake>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof Intake>(key: K, value: Intake[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = intakeSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(errorsFrom(parsed.error.issues));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await postJson("/api/analyze", parsed.data, analyzeResponseSchema);
      const now = new Date().toISOString();
      const lead: Lead = {
        id: newId(),
        ...parsed.data,
        status: "New",
        createdAt: now,
        updatedAt: now,
        lastContactedAt: null,
        followUpDueAt: addDaysFromNow(
          followUpOffsetDays(parsed.data.timeline, result.analysis.urgencyFlag),
        ),
        contactLogs: [],
        callNotes: [],
        matches: [],
        analysis: result.analysis,
        chat: [],
        analyzedBy: result.provider,
      };
      saveLead(lead);
      router.push(`/leads/${lead.id}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The analysis failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5" noValidate>
      <div>
        <h1 className="font-display text-4xl text-brand-dark">New lead</h1>
        <p className="mt-1 text-muted">
          Paste an inquiry or a chat transcript. The score and the reply are generated on the server.
        </p>
      </div>

      {formError ? <ErrorBanner message={formError} /> : null}

      <div className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <Field label="Phone (optional, for WhatsApp)" error={errors.phone}>
          <input
            className={fieldClass}
            value={values.phone}
            placeholder="98100 12345"
            onChange={(event) => set("phone", event.target.value)}
          />
        </Field>
        <Field label="Name" error={errors.name}>
          <input className={fieldClass} value={values.name} onChange={(event) => set("name", event.target.value)} />
        </Field>
        <Field label="Location" error={errors.location}>
          <input
            className={fieldClass}
            value={values.location}
            placeholder="Noida, Sector 150"
            onChange={(event) => set("location", event.target.value)}
          />
        </Field>
        <Field label="Property requirement" error={errors.propertyRequirement}>
          <input
            className={fieldClass}
            value={values.propertyRequirement}
            placeholder="3 BHK, ready to move, high floor"
            onChange={(event) => set("propertyRequirement", event.target.value)}
          />
        </Field>
        <Field label="Budget" error={errors.budget}>
          <input
            className={fieldClass}
            value={values.budget}
            placeholder="₹1.6 Cr, loan pre-approved"
            onChange={(event) => set("budget", event.target.value)}
          />
        </Field>
        <Field label="Buying timeline" error={errors.timeline}>
          <select
            className={fieldClass}
            value={values.timeline}
            onChange={(event) => set("timeline", event.target.value as Intake["timeline"])}
          >
            {TIMELINES.map((timeline) => (
              <option key={timeline} value={timeline}>
                {timeline}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Customer message" error={errors.message}>
          <textarea
            className={`${fieldClass} min-h-40`}
            value={values.message}
            onChange={(event) => set("message", event.target.value)}
          />
          <p className={`mt-1 text-xs ${values.message.length > LIMITS.message ? "text-rose-700" : "text-muted"}`}>
            {values.message.length}/{LIMITS.message}
          </p>
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primaryButton} disabled={loading}>
          {loading ? "Reading the lead…" : "Analyze lead"}
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={loading}
          onClick={() => {
            setValues(SAMPLE_INTAKE);
            setErrors({});
            setFormError(null);
          }}
        >
          Load sample lead
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      {children}
      {error ? <span className="mt-1 block font-normal text-rose-700">{error}</span> : null}
    </label>
  );
}
