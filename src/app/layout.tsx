import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { site } from "@/content/site";
import "./globals.css";

const heading = Manrope({ subsets: ["latin"], variable: "--font-heading", display: "swap", weight: ["500", "600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap", weight: ["500", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} · Palghar — Coaching & Court Booking`,
    template: `%s · ${site.shortName} Badminton Academy`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: ["badminton academy Palghar", "badminton coaching", "court booking", "badminton courts near me", "kids badminton classes", "SmashPoint"],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: site.name,
    title: `${site.name} — Palghar`,
    description: site.description,
  },
  twitter: { card: "summary_large_image", title: site.name, description: site.description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#111318",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${heading.variable} ${body.variable} ${code.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:border focus:border-line focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
