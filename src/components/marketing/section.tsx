import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[88rem] px-4 sm:px-6", className)}>{children}</div>;
}

export function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn("py-16 md:py-24", className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ index, children, inverted }: { index?: string; children: ReactNode; inverted?: boolean }) {
  return (
    <p className={cn("inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.2em]", inverted ? "text-white/80" : "text-brand")}>
      {index ? <span className={cn("rounded-md border px-1.5 py-0.5", inverted ? "border-white text-white" : "border-line bg-white text-ink")}>{index}</span> : null}
      {children}
    </p>
  );
}

export function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  action,
  inverted,
  align = "left",
  className,
}: {
  index?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  inverted?: boolean;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between", align === "center" && "items-center text-center md:flex-col md:items-center", className)}>
      <div className={cn("max-w-3xl", align === "center" && "mx-auto")}>
        {eyebrow ? <Eyebrow index={index} inverted={inverted}>{eyebrow}</Eyebrow> : null}
        <h2 className={cn("mt-4 text-4xl font-semibold leading-[0.95] sm:text-5xl lg:text-6xl", inverted && "text-white")}>{title}</h2>
        {description ? <p className={cn("mt-5 max-w-2xl text-lg", inverted ? "text-white/80" : "text-muted")}>{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Blue marker highlight for a word inside a heading. */
export function Mark({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "white" | "ink" }) {
  const tones = {
    blue: "bg-brand text-white",
    white: "bg-white text-ink",
    ink: "bg-ink text-white",
  };
  return <span className={cn("mx-[0.04em] inline-block rounded-[0.18em] border-[3px] border-line px-[0.14em] leading-[1.05] shadow-xs", tones[tone])}>{children}</span>;
}

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  aside,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <Container className="grid gap-10 py-14 md:py-20 lg:grid-cols-[1.35fr_1fr] lg:items-end">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 text-5xl font-semibold leading-[0.92] sm:text-6xl lg:text-7xl">{title}</h1>
          {description ? <p className="mt-6 max-w-2xl text-lg text-muted md:text-xl">{description}</p> : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
        {aside ? <div className="relative">{aside}</div> : null}
      </Container>
    </section>
  );
}
