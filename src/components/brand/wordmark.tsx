import Image from "next/image";
import emblem from "@/assets/brand/on-the-sol-emblem.png";
import { site } from "@/content/site";
import { cn } from "@/lib/utils";

/** The academy's logo emblem ("Sol To Success!"), cut out of its rate card. */
export function Mark({ className, size = 44, eager = false }: { className?: string; size?: number; eager?: boolean }) {
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center rounded-full bg-white p-[2px] shadow-[0_0_0_2px_var(--color-gold)]", className)} style={{ width: size, height: size }}>
      <Image src={emblem} alt="" width={size} height={size} sizes={`${size}px`} quality={80} loading={eager ? "eager" : undefined} className="size-full rounded-full" />
    </span>
  );
}

/**
 * Logo lockup: the emblem with "ON THE SOL" over a gold, tracked "SPORTS ACADEMY" — the
 * typographic treatment of the academy's rate card.
 */
export function Wordmark({ className, tone = "light", size = "md", eager = false }: { className?: string; tone?: "light" | "dark"; size?: "sm" | "md" | "lg"; eager?: boolean }) {
  const mark = size === "lg" ? 60 : size === "sm" ? 36 : 44;
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Mark size={mark} eager={eager} />
      <span className="flex flex-col">
        <span className={cn("wordmark whitespace-nowrap", size === "lg" ? "text-[1.85rem]" : size === "sm" ? "text-[1.1rem]" : "text-[1.32rem]", tone === "light" ? "text-white" : "text-ink")}>
          {site.brand.primary}
        </span>
        <span
          className={cn(
            "mt-[3px] font-display font-bold whitespace-nowrap uppercase",
            size === "lg" ? "text-[0.74rem] tracking-[0.42em]" : size === "sm" ? "text-[0.5rem] tracking-[0.36em]" : "text-[0.58rem] tracking-[0.4em]",
            tone === "light" ? "text-gold" : "text-gold-700",
          )}
        >
          {site.brand.secondary}
        </span>
      </span>
    </span>
  );
}
