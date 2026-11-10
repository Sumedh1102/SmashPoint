import Image from "next/image";
import emblem from "@/assets/brand/on-the-sol-emblem.png";
import { site } from "@/content/site";
import { cn } from "@/lib/utils";

/** The academy's logo emblem ("Sol To Success!"), cut out of its rate card. */
export function Mark({ className, size = 40, eager = false }: { className?: string; size?: number; eager?: boolean }) {
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center rounded-full", className)} style={{ width: size, height: size }}>
      <Image src={emblem} alt="" width={size} height={size} sizes={`${size}px`} quality={80} loading={eager ? "eager" : undefined} className="size-full rounded-full" />
    </span>
  );
}

/**
 * Logo lockup: the emblem with "ON THE SOL" over a small, tracked "SPORTS ACADEMY" — the
 * typographic treatment of the academy's rate card, in white with a neon second line.
 */
export function Wordmark({ className, tone = "light", size = "md", eager = false }: { className?: string; tone?: "light" | "dark"; size?: "sm" | "md" | "lg"; eager?: boolean }) {
  const mark = size === "lg" ? 52 : size === "sm" ? 34 : 40;
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Mark size={mark} eager={eager} />
      <span className="flex flex-col">
        <span className={cn("wordmark whitespace-nowrap", size === "lg" ? "text-[1.7rem]" : size === "sm" ? "text-[1.05rem]" : "text-[1.25rem]", tone === "light" ? "text-white" : "text-ink")}>
          {site.brand.primary}
        </span>
        <span
          className={cn(
            "mt-[3px] font-display font-bold whitespace-nowrap uppercase",
            size === "lg" ? "text-[0.68rem] tracking-[0.42em]" : size === "sm" ? "text-[0.48rem] tracking-[0.36em]" : "text-[0.55rem] tracking-[0.4em]",
            tone === "light" ? "text-neon" : "text-neon-ink",
          )}
        >
          {site.brand.secondary}
        </span>
      </span>
    </span>
  );
}
