import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";

export const metadata: Metadata = { title: "New lead · LeadLens" };

export default function NewLeadPage() {
  return <LeadForm />;
}
