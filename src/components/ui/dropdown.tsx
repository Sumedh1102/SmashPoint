"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DropdownItem =
  | { type?: "link"; label: ReactNode; href: string; icon?: ReactNode }
  | { type: "button"; label: ReactNode; onSelect: () => void; icon?: ReactNode; danger?: boolean }
  | { type: "separator" };

export function Dropdown({
  trigger,
  items,
  align = "end",
  className,
  label = "Open menu",
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "start" | "end";
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemCls = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-ink-soft hover:bg-paper hover:text-ink";

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen((o) => !o)} className="contents">
        {trigger}
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          className={cn(
            "animate-pop absolute z-50 mt-2 min-w-52 rounded-lg border border-line bg-white p-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => {
            if (item.type === "separator") return <div key={i} className="my-1 h-px bg-line" role="separator" />;
            if (item.type === "button") {
              return (
                <button
                  key={i}
                  role="menuitem"
                  type="button"
                  className={cn(itemCls, item.danger && "text-danger hover:bg-danger-soft")}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            }
            return (
              <Link key={i} role="menuitem" href={item.href} className={itemCls} onClick={() => setOpen(false)}>
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
