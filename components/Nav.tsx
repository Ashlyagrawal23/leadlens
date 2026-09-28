"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/new", label: "New lead" },
  { href: "/plan", label: "Today's plan" },
];

export function Nav() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="min-w-0">
          <span className="font-display text-2xl leading-none text-brand-dark">LeadLens</span>
          <span className="mt-1 hidden text-sm text-muted sm:block">Which lead to work, and what to say</span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto" aria-label="Primary">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? path === "/" || path.startsWith("/leads") : path.startsWith(link.href);
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
    </header>
  );
}
