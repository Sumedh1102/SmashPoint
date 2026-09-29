import Link from "next/link";
import { ArrowLeft, CalendarCheck2, ShieldCheck, Trophy } from "lucide-react";
import { CourtArt } from "@/components/brand/court-art";
import { Logo } from "@/components/brand/logo";
import { site } from "@/content/site";

const POINTS = [
  { icon: CalendarCheck2, text: "Book badminton, pickleball and basketball courts in real time" },
  { icon: Trophy, text: "Monthly and quarterly slots for regular players" },
  { icon: ShieldCheck, text: "Secure payments, instant receipts and reminders" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh bg-white lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-25">
          <CourtArt kind="badminton" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/40" />
        <div className="relative">
          <Logo inverted />
        </div>
        <div className="relative">
          <h2 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Play. Train. Compete.</h2>
          <ul className="mt-8 grid max-w-md gap-4">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-start gap-3 text-white/80">
                <p.icon className="mt-0.5 size-5 shrink-0 text-brand-200" strokeWidth={1.75} />
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/50">
          © {new Date().getFullYear()} {site.name}
        </p>
      </section>
      <section className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link href="/" className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Back to site
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </section>
    </main>
  );
}
