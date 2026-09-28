"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ProviderSwitch } from "@/components/ProviderSwitch";

// 24×24 stroke icons for the phone tab bar. Kept inline so there is no icon package.
const ICONS: Record<string, ReactNode> = {
  inbox: <path d="M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6l2-8Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  columns: <path d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v7h-4z" />,
  calendar: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
};

const LINKS = [
  { href: "/", label: "Dashboard", short: "Inbox", icon: "inbox" },
  { href: "/new", label: "New lead", short: "New", icon: "plus" },
  { href: "/pipeline", label: "Pipeline", short: "Pipeline", icon: "columns" },
  { href: "/plan", label: "Today's plan", short: "Plan", icon: "calendar" },
  { href: "/insights", label: "Insights", short: "Insights", icon: "chart" },
];

function isActive(href: string, path: string): boolean {
  return href === "/" ? path === "/" || path.startsWith("/leads") : path.startsWith(href);
}

/**
 * Desktop (lg and up): logo, provider switch, and links in one top bar.
 * Phones and portrait tablets: logo and switch on top, links in a bottom
 * tab bar where a thumb can reach them, padded above the iPhone home
 * indicator and the Android gesture bar.
 */
export function Nav() {
  const path = usePathname();

  return (
    <>
      {/* Phones in landscape have ~390px of height. There the header scrolls away and only the tab bar stays. */}
      <header className="sticky top-0 z-20 border-b [@media(max-height:500px)]:static border-line bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 py-2.5 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] lg:py-3">
          <Link href="/" className="shrink-0">
            <span className="font-display text-2xl leading-none text-brand-dark">LeadLens</span>
            <span className="mt-1 hidden text-sm text-muted xl:block">
              Which lead to work, and what to say
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <ProviderSwitch />
            <nav className="hidden gap-1 lg:flex" aria-label="Primary">
              {LINKS.map((link) => {
                const active = isActive(link.href, path);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${
                      active ? "bg-brand text-white" : "text-ink hover:bg-stone-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {LINKS.map((link) => {
            const active = isActive(link.href, path);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                    active ? "text-brand" : "text-muted"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? "bg-emerald-100" : ""}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={active ? 2.2 : 1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {ICONS[link.icon]}
                    </svg>
                  </span>
                  {link.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
