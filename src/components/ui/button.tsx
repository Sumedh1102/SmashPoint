import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

const variants = {
  /** Golden yellow with navy text — the one primary action per view. */
  primary: "bg-gold text-ink hover:bg-gold-600 shadow-[inset_0_-2px_0_rgb(0_0_0/0.1),0_6px_16px_-8px_rgb(217_154_19/0.7)]",
  /** Navy. */
  dark: "bg-ink text-white hover:bg-ink-3",
  /** Royal blue — secondary emphasis on light surfaces. */
  royal: "bg-royal text-white hover:bg-royal-700",
  outline: "border border-line-strong bg-white/70 text-ink hover:border-ink hover:bg-white",
  /** Outline for navy surfaces. */
  ghostLight: "border border-white/30 text-white hover:border-white/70 hover:bg-white/8",
  ghost: "text-ink hover:bg-paper-2",
  danger: "bg-danger text-white hover:bg-[#9a2f24]",
} as const;

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-[0.95rem]",
} as const;

export type ButtonVariant = keyof typeof variants;
type Common = { variant?: ButtonVariant; size?: keyof typeof sizes };

export function buttonClass({ variant = "primary", size = "md" }: Common = {}, className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({ variant, size, className, type = "button", ...props }: Common & ComponentProps<"button">) {
  return <button type={type} className={buttonClass({ variant, size }, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: Common & ComponentProps<typeof Link>) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-4 animate-spin-slow rounded-full border-2 border-current border-r-transparent", className)} />;
}
