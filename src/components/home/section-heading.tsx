import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section title block: eyebrow and condensed heading on the left, an optional intro on the right. */
export function SectionHeading({ id, eyebrow, title, intro, className }: { id: string; eyebrow: string; title: ReactNode; intro?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-10", className)}>
      <div>
        <p className="eyebrow text-neon">{eyebrow}</p>
        <h2 id={id} className="display mt-4 text-[clamp(2.75rem,6.5vw,5rem)] text-white">
          {title}
        </h2>
      </div>
      {intro ? <p className="max-w-md text-base leading-relaxed text-ink-muted lg:text-right">{intro}</p> : null}
    </div>
  );
}
