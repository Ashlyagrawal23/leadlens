import type { Metadata, Viewport } from "next";
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
  applicationName: "LeadLens",
  // "Add to Home Screen" on iPhone and iPad opens full screen, with this name under the icon.
  appleWebApp: { capable: true, title: "LeadLens", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page draw under the notch and home indicator. Nav and body pad with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: "#fffdf8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full`}>
      {/* Bottom padding keeps the last card above the phone tab bar and the home indicator. */}
      <body className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] antialiased lg:pb-0">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 py-5 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:py-6">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-sm text-muted lg:pb-8">
          Leads stay in this browser. Use Reset demo data on the dashboard to start over.
        </footer>
      </body>
    </html>
  );
}
