import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section title block: gold-ruled eyebrow, display heading and an optional intro. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  tone = "light",
  align = "split",
  className,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  tone?: "light" | "dark";
  align?: "split" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "split" ? "lg:flex-row lg:items-end lg:justify-between lg:gap-10" : "mx-auto max-w-3xl items-center text-center",
        className,
      )}
    >
      <div data-reveal className={align === "center" ? "flex flex-col items-center" : undefined}>
        <p className={cn("eyebrow flex items-center gap-3", tone === "dark" ? "text-gold" : "text-gold-700")}>
          <span aria-hidden className="h-0.5 w-8 rounded-full bg-gold" />
          {eyebrow}
        </p>
        <h2 id={id} className={cn("display mt-4 text-[clamp(2.4rem,6vw,4.4rem)]", tone === "dark" ? "text-white" : "text-ink")}>
          {title}
        </h2>
      </div>
      {intro ? (
        <p data-reveal className={cn("max-w-md text-base leading-relaxed", align === "split" && "lg:text-right", tone === "dark" ? "text-white/75" : "text-muted")}>
          {intro}
        </p>
      ) : null}
    </div>
  );
}
