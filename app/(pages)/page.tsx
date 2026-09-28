import type { Metadata } from "next";
import { LeadBoard } from "@/components/LeadBoard";

export const metadata: Metadata = { title: "Dashboard · LeadLens" };

export default function DashboardPage() {
  return <LeadBoard />;
}
