import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Chunky "3D" icon tile — thick outline, hard shadow, slight tilt. Use a few, never many. */
export function FloatingTile({
  children,
  tone = "white",
  rotate = 0,
  float,
  className,
  size = "md",
}: {
  children: ReactNode;
  tone?: "white" | "blue" | "ink" | "yellow" | "soft";
  rotate?: number;
  float?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const tones = {
    white: "bg-white text-ink",
    blue: "bg-brand text-white",
    ink: "bg-ink text-white",
    yellow: "bg-warning text-ink",
    soft: "bg-brand-100 text-brand-700",
  };
  const sizes = { sm: "size-11 rounded-xl [&_svg]:size-5", md: "size-14 rounded-2xl [&_svg]:size-6", lg: "size-20 rounded-2xl [&_svg]:size-9" };
  return (
    <span
      className={cn("inline-grid place-items-center border border-line shadow-sm", tones[tone], sizes[size], float && "", className)}
      style={{ rotate: `${rotate}deg`, ["--tw-rotate" as string]: `${rotate}deg` }}
      aria-hidden
    >
      {children}
    </span>
  );
}
