import { ArrowRight } from "lucide-react";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { Parallax } from "@/components/motion/parallax";
import { buttonClass } from "@/components/ui/button";
import heroCourt from "@/assets/images/hero-court.webp";
import heroCourtPortrait from "@/assets/images/hero-court-portrait.webp";
import heroRacket from "@/assets/images/hero-racket.webp";
import heroShuttle from "@/assets/images/hero-shuttle.webp";
import { HeroDepth } from "./hero-depth";

const FACTS = [
  { value: "05", label: "Indoor courts" },
  { value: "03", label: "Sports" },
  { value: "15", label: "Hours a day · 7 AM – 10 PM" },
  { value: "Live", label: "Availability" },
];

/** Art-directed backdrop: wide hall on desktop, portrait crop on phones. */
function Backdrop() {
  const common = { alt: "", sizes: "100vw", quality: 75 } as const;
  const { props: wide } = getImageProps({ ...common, src: heroCourt });
  const { props: tall } = getImageProps({ ...common, src: heroCourtPortrait });
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={wide.srcSet} sizes="100vw" />
      <img {...tall} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover object-[60%_center] md:object-center" />
    </picture>
  );
}

export function SportsHero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink text-white">
      <HeroDepth className="absolute inset-0 -z-10">
        {/* Background: the hall, slowest layer */}
        <Parallax speed={0.32} scale={1.08} className="absolute inset-0">
          <div className="absolute inset-0 transition-transform duration-300 ease-out [transform:translate3d(calc(var(--px)*-10px),calc(var(--py)*-6px),0)]">
            <Backdrop />
          </div>
        </Parallax>
        {/* Legibility: darken behind the headline and fade into the next section */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(10_12_11/0.92)_0%,rgb(10_12_11/0.72)_38%,rgb(10_12_11/0.15)_70%,rgb(10_12_11/0.25)_100%)] max-md:bg-[linear-gradient(180deg,rgb(10_12_11/0.55)_0%,rgb(10_12_11/0.35)_35%,rgb(10_12_11/0.88)_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />

        {/* Racket: mid layer (desktop and tablet) */}
        <Parallax speed={0.14} minWidth={768} className="pointer-events-none absolute top-[9%] right-[-7%] hidden w-[46vw] max-w-[760px] md:block lg:right-[-3%] lg:w-[40vw]">
          <div className="[transform:translate3d(calc(var(--px)*-22px),calc(var(--py)*-14px),0)_rotateY(calc(var(--px)*6deg))_rotateX(calc(var(--py)*-4deg))] transition-transform duration-300 ease-out [transform-style:preserve-3d]">
            <Image src={heroRacket} alt="" sizes="(min-width: 768px) 40vw, 1px" quality={80} loading="eager" fetchPriority="high" className="h-auto w-full drop-shadow-[0_40px_60px_rgb(0_0_0/0.55)]" />
          </div>
        </Parallax>

        {/* Shuttle: foreground, fastest layer, with a soft flight trail (tablet and up; phones get a calmer hero) */}
        <Parallax speed={-0.12} minWidth={768} className="pointer-events-none absolute top-[11%] right-[30%] hidden w-[11vw] max-w-[200px] md:block lg:right-[27%]">
          <div className="relative animate-float [transform:translate3d(calc(var(--px)*-36px),calc(var(--py)*-24px),0)] transition-transform duration-300 ease-out">
            <span aria-hidden className="absolute top-[58%] left-[52%] h-[14%] w-[190%] origin-left rotate-[33deg] rounded-full bg-[linear-gradient(90deg,rgb(255_255_255/0.28),rgb(200_240_74/0.10)_45%,transparent)] blur-[6px]" />
            <Image src={heroShuttle} alt="" sizes="(min-width: 768px) 11vw, 1px" quality={80} className="relative h-auto w-full drop-shadow-[0_24px_30px_rgb(0_0_0/0.5)]" />
          </div>
        </Parallax>
      </HeroDepth>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-4 pt-28 pb-10 sm:px-6 sm:pb-14 lg:px-8 lg:pb-16">
        <p className="eyebrow animate-rise text-lime" style={{ animationDelay: "80ms" }}>
          Badminton · Pickleball · Basketball
        </p>
        <h1 id="hero-title" className="display mt-5 text-[clamp(3.6rem,13vw,10.5rem)] leading-[0.84]">
          <span className="block animate-rise" style={{ animationDelay: "160ms" }}>
            Your game.
          </span>
          <span className="block animate-rise text-lime" style={{ animationDelay: "260ms" }}>
            Your court.
          </span>
        </h1>
        <p className="mt-6 max-w-xl animate-rise text-base leading-relaxed text-white/80 sm:text-lg" style={{ animationDelay: "360ms" }}>
          Premium badminton, pickleball, and basketball courts. Choose your sport, find an available slot, and get ready to play.
        </p>
        <div className="mt-8 flex animate-rise flex-col gap-3 sm:flex-row" style={{ animationDelay: "440ms" }}>
          <Link href="#book" className={buttonClass({ variant: "primary", size: "lg" }, "uppercase tracking-wide")}>
            Book a court <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="#courts" className={buttonClass({ variant: "ghostLight", size: "lg" }, "uppercase tracking-wide")}>
            Explore our courts
          </Link>
        </div>

        <dl className="mt-14 grid animate-rise grid-cols-2 gap-y-6 border-t border-white/12 pt-6 sm:grid-cols-4" style={{ animationDelay: "540ms" }}>
          {FACTS.map((f, i) => (
            <div key={f.label} className={i % 2 === 1 ? "border-l border-white/12 pl-5 sm:pl-6" : i > 0 ? "sm:border-l sm:border-white/12 sm:pl-6" : ""}>
              <dt className="sr-only">{f.label}</dt>
              <dd>
                <span className="display block text-[2.4rem] leading-none sm:text-[2.8rem]">{f.value}</span>
                <span className="eyebrow mt-1.5 block text-[0.68rem] text-ink-muted">{f.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

    </section>
  );
}
