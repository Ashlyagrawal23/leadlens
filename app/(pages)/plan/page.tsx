import type { Metadata } from "next";
import { PlanView } from "@/components/PlanView";

export const metadata: Metadata = { title: "Today's plan · LeadLens" };

export default function PlanPage() {
  return <PlanView />;
}
