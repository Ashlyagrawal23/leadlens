import type { Metadata } from "next";
import { PipelineBoard } from "@/components/PipelineBoard";

export const metadata: Metadata = { title: "Pipeline · LeadLens" };

export default function PipelinePage() {
  return <PipelineBoard />;
}
