import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,color,border-color,transform] duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

const variants = {
  /** Neon with black text — the one primary action per view (works on any surface). */
  primary: "bg-neon text-ink hover:bg-neon-300",
  /** White on black surfaces; turns neon on hover. */
  light: "bg-white text-ink hover:bg-neon",
  /** Outline for black surfaces. */
  ghostLight: "border border-ink-line-strong text-white hover:border-white hover:bg-white/5",
  /** Black, for light surfaces (admin). */
  dark: "bg-ink text-white hover:bg-ink-4",
  /** Outline for light surfaces (admin). */
  outline: "border border-line-strong bg-white text-ink hover:border-ink",
  ghost: "text-ink hover:bg-paper-2",
  danger: "bg-[#b4372a] text-white hover:bg-[#9a2f24]",
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
