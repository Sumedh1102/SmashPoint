import Image from "next/image";
import facilityHall from "@/assets/images/facility-hall.webp";
import { Mark } from "@/components/brand/wordmark";
import { site } from "@/content/site";

/** Facts taken from the academy's rate card — no invented claims. */
const FACTS = [
  { value: "3", label: "Sports", detail: "Badminton, pickleball and basketball" },
  { value: "1–2", label: "Hour bookings", detail: "Book a court online" },
  { value: "1–12", label: "Month plans", detail: "Monthly rentals, Monday to Saturday" },
];

export function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-title" className="scroll-mt-16 overflow-hidden bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="relative">
          <div data-reveal="image" className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-ink shadow-lg">
            <Image
              src={facilityHall}
              alt="Illustration of a sports hall with courts under arena lights"
              fill
              sizes="(min-width: 1024px) 46vw, 100vw"
              placeholder="blur"
              className="object-cover"
            />
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(200deg,rgb(8_120_201/0.25),rgb(7_27_58/0.35))]" />
          </div>
          <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg sm:left-8">
            <Mark size={46} />
            <span>
              <span className="eyebrow block text-[0.62rem] text-gold">Our motto</span>
              <span className="font-display text-lg font-bold italic">{site.motto}</span>
            </span>
          </div>
          <span aria-hidden className="absolute -top-4 -right-4 -z-0 hidden h-28 w-28 rounded-3xl border-2 border-gold/50 lg:block" />
        </div>

        <div>
          <p data-reveal className="eyebrow flex items-center gap-3 text-gold-700">
            <span aria-hidden className="h-0.5 w-8 rounded-full bg-gold" />
            About us
          </p>
          <h2 id="about-title" data-reveal className="display mt-4 text-[clamp(2.4rem,6vw,4.4rem)]">
            Three sports. <span className="text-royal">One academy.</span>
          </h2>
          <div data-reveal className="mt-6 space-y-4 text-base leading-relaxed text-muted sm:text-lg">
            <p>
              On The Sol Sports Academy brings badminton, pickleball and basketball together in one place. Rent a court by the hour for a game with friends, take
              a monthly plan for regular play, or train with our coaches.
            </p>
            <p>
              Our coaches are state certified and highly experienced in preparing players for state-level and national-level competitions.
            </p>
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
            {FACTS.map((f, i) => (
              <div key={f.label} data-reveal style={{ ["--reveal-delay" as string]: `${i * 80}ms` }} className="rounded-2xl border border-line bg-paper p-3.5 sm:p-5">
                <dt className="sr-only">{f.label}</dt>
                <dd>
                  <span className="display block text-[1.75rem] text-royal sm:text-[2.3rem]">{f.value}</span>
                  <span className="mt-1 block text-[0.7rem] font-bold tracking-wide text-ink uppercase sm:text-xs">{f.label}</span>
                  <span className="mt-1 hidden text-xs text-muted sm:block">{f.detail}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
