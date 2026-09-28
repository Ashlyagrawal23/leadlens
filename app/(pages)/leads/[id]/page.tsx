import type { Metadata } from "next";
import { LeadDetail } from "@/components/LeadDetail";

export const metadata: Metadata = { title: "Lead · LeadLens" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetail id={id} />;
}
