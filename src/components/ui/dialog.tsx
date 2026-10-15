"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog>: focus is trapped and restored by the
 * browser, Escape closes it, and the page behind is inert. On phones it opens as a
 * bottom sheet that fits the screen (never clipped; its body scrolls).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** When false, Escape and the backdrop don't close it (e.g. while a payment is processing). */
  dismissible?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[1.25rem] bg-paper p-0 text-ink shadow-lg open:flex open:flex-col open:animate-rise",
        "sm:m-auto sm:max-h-[min(88dvh,52rem)] sm:w-[min(36rem,calc(100vw-2rem))] sm:rounded-[var(--radius-card)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
        <div className="min-w-0">
          <h2 id={titleId} className="display text-[1.75rem] sm:text-[2rem]">
            {title}
          </h2>
          {description ? (
            <div id={descId} className="mt-1.5 text-sm text-muted">
              {description}
            </div>
          ) : null}
        </div>
        {dismissible ? (
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-paper-2 hover:text-ink">
            <X className="size-5" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">{children}</div>
      {footer ? <div className="safe-bottom border-t border-line bg-white/70 px-5 pt-3 sm:px-7 sm:pb-4">{footer}</div> : null}
    </dialog>
  );
}
