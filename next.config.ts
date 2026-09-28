import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next otherwise rewrites AGENTS.md on every `next dev`. This repo's guide is the README.
  agentRules: false,
};

export default nextConfig;
