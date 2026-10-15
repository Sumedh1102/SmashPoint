import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

const variants = {
  /** Electric lime — the one primary action per view. */
  primary: "bg-lime text-ink hover:bg-lime-600 shadow-[inset_0_-2px_0_rgb(0_0_0/0.08)]",
  dark: "bg-ink text-white hover:bg-ink-3",
  court: "bg-court text-white hover:bg-court-700",
  outline: "border border-line-strong bg-white/60 text-ink hover:border-ink hover:bg-white",
  /** Outline for dark surfaces. */
  ghostLight: "border border-white/25 text-white hover:border-white/60 hover:bg-white/5",
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
