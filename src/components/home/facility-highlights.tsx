import { CalendarCheck2, Clock3, LayoutGrid, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { Parallax } from "@/components/motion/parallax";
import facilityHall from "@/assets/images/facility-hall.webp";

/** Only verifiable facts about the facility and how booking works — no invented claims. */
const HIGHLIGHTS = [
  { icon: LayoutGrid, title: "Five courts, three sports", body: "Two badminton courts, two pickleball courts and one basketball court under one roof." },
  { icon: Clock3, title: "Open 7 AM – 10 PM", body: "Every day. Book one or two hours; every booking finishes by 10 PM." },
  { icon: CalendarCheck2, title: "Live availability", body: "See which slots are free right now and book in a few taps — no account needed." },
  { icon: ShieldCheck, title: "Secure checkout", body: "Pay through Razorpay. Your court is confirmed as soon as the payment is verified." },
];

export function FacilityHighlights() {
  return (
    <section id="facility" aria-labelledby="facility-title" className="relative isolate overflow-hidden bg-ink py-24 text-white sm:py-32">
      <div className="absolute inset-0 -z-10">
        <Parallax speed={0.18} scale={1.12} className="absolute inset-0">
          <Image src={facilityHall} alt="" fill sizes="100vw" quality={70} placeholder="blur" className="object-cover opacity-55" />
        </Parallax>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--color-ink)_0%,rgb(10_12_11/0.55)_35%,rgb(10_12_11/0.75)_70%,var(--color-ink)_100%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div data-reveal>
            <p className="eyebrow text-lime">About the facility</p>
            <h2 id="facility-title" className="display mt-4 text-[clamp(2.8rem,7vw,5.5rem)]">
              Three sports.
              <br />
              One address.
            </h2>
          </div>
          <p data-reveal className="max-w-xl text-base leading-relaxed text-white/75 sm:text-lg lg:justify-self-end">
            Indoor courts for badminton, pickleball and basketball, open every day of the week. Pick a sport, see what&apos;s free and lock in your court
            before you leave home.
          </p>
        </div>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }} className="bg-ink/80 p-6 backdrop-blur-sm sm:p-7">
              <Icon aria-hidden className="size-6 text-lime" strokeWidth={1.75} />
              <h3 className="display mt-6 text-[1.55rem]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </li>
          ))}
        </ul>

        <div data-reveal className="mt-6 flex flex-col gap-2 rounded-[var(--radius-card)] border border-lime/25 bg-lime/[0.06] px-5 py-4 text-sm sm:flex-row sm:items-center sm:gap-4">
          <span className="eyebrow shrink-0 text-lime">Badminton academy</span>
          <span className="text-white/80">Academy sessions use both badminton courts every day from 5:00 PM to 7:00 PM. Pickleball and basketball stay open.</span>
        </div>
      </div>
    </section>
  );
}
