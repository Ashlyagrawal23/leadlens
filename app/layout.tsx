import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans-app",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-app",
});

export const metadata: Metadata = {
  title: "LeadLens",
  description: "See which real-estate leads matter, what the customer wants, and what to do next.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-sm text-muted">
          Leads stay in this browser. Use Reset demo data on the dashboard to start over.
        </footer>
      </body>
    </html>
  );
}
