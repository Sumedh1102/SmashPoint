import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { site } from "@/content/site";
import "./globals.css";

const display = Archivo({ subsets: ["latin"], variable: "--font-display-face", display: "swap", axes: ["wdth"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

const title = `${site.name} — Badminton, Pickleball & Basketball Court Booking`;
const shareTitle = `${site.name} — Your game. Your court.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: title,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "On The Sol Sports Academy",
    "badminton court booking",
    "badminton court rental",
    "pickleball court booking",
    "pickleball court rental",
    "basketball court booking",
    "basketball court rental",
    "monthly court rental",
    "sports academy",
    "badminton coaching",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: site.name,
    title: shareTitle,
    description: site.description,
  },
  twitter: { card: "summary_large_image", title: shareTitle, description: site.description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-neon focus:px-5 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-ink"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
