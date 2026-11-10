import { ArrowRight, Award, Medal, Trophy } from "lucide-react";
import Image from "next/image";
import heroCourt from "@/assets/images/hero-court.webp";
import { buttonClass } from "@/components/ui/button";
import { enquiryHref } from "./rental-pricing";

/**
 * The academy's coaching credentials, as stated on its rate card: "All our coaches are state
 * certified and highly experienced in training players for states and nationals." No coach
 * names, certificates or results are shown — none have been provided.
 */
const POINTS = [
  { icon: Award, title: "State certified", body: "Every coach at the academy is state certified." },
  { icon: Trophy, title: "State-level experience", body: "Experienced in preparing players for state-level competition." },
  { icon: Medal, title: "National-level experience", body: "Experienced in preparing players for national-level competition." },
];

export function CoachingSection() {
  return (
    <section id="coaching" aria-labelledby="coaching-title" className="surface-dark relative isolate scroll-mt-16 overflow-hidden bg-ink py-20 text-white sm:py-28">
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image src={heroCourt} alt="" fill sizes="100vw" quality={70} placeholder="blur" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-ink)_15%,rgb(7_27_58/0.82)_55%,rgb(7_27_58/0.55)_100%)] max-lg:bg-[linear-gradient(180deg,rgb(7_27_58/0.7),var(--color-ink)_70%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p data-reveal className="eyebrow flex items-center gap-3 text-gold">
              <span aria-hidden className="h-0.5 w-8 rounded-full bg-gold" />
              Coaching &amp; academy
            </p>
            <h2 id="coaching-title" data-reveal className="display mt-4 text-[clamp(2.8rem,7.5vw,5.6rem)]">
              Train with <span className="text-gold">the best.</span>
            </h2>
            <p data-reveal className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              Our coaches are state certified and highly experienced in preparing players for state-level and national-level competitions.
            </p>
            <a data-reveal href={enquiryHref("Coaching enquiry")} className={buttonClass({ variant: "primary", size: "lg" }, "mt-9 uppercase tracking-wide")}>
              Enquire about coaching <ArrowRight aria-hidden className="size-4" />
            </a>
          </div>

          <ul className="grid gap-4">
            {POINTS.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm sm:p-6"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold text-ink">
                  <Icon aria-hidden className="size-6" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="display block text-[1.45rem]">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-white/70">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
