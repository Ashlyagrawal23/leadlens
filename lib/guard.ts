import { NextResponse } from "next/server";
import { LlmError } from "@/lib/llm";

/**
 * Shared checks for every API route.
 *
 * The rate limit is in-memory, so on Vercel each server instance counts
 * separately. It still stops a single browser from looping the free tier
 * during local dev. The hard cap is the Zod max length on the message.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const hits = new Map<string, number[]>();

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "local";
}

function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

/** Returns a response when the caller should stop, or null when the request may continue. */
export function rateLimit(request: Request): NextResponse | null {
  if (allow(clientIp(request))) return null;
  return jsonError(
    429,
    "RATE_LIMIT",
    "Too many requests from this browser. Wait a minute and try again.",
  );
}

export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 120_000) {
    throw new HttpError(413, "VALIDATION", "That request is too large.");
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "VALIDATION", "The request body must be JSON.");
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) return jsonError(error.status, error.code, error.message);
  if (error instanceof LlmError) return jsonError(error.status, error.code, error.message);
  console.error(error);
  return jsonError(500, "UPSTREAM", "Something went wrong on the server. Please try again.");
}

/** Vercel route config shared by the five AI routes. */
export const aiRouteConfig = {
  runtime: "nodejs" as const,
  maxDuration: 60,
};
