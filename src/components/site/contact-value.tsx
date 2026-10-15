import { isPlaceholder } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * Shows a contact detail as a link, or — while it still holds its [placeholder] text — as a
 * clearly marked placeholder that is never linked.
 */
export function ContactValue({ value, href, className }: { value: string; href: string | null; className?: string }) {
  if (isPlaceholder(value)) {
    return (
      <span className={cn("italic opacity-70 underline decoration-dashed decoration-1 underline-offset-4", className)} title="Placeholder — set the real value in src/content/site.ts">
        {value}
      </span>
    );
  }
  return href ? (
    <a href={href} className={cn("underline-offset-4 hover:underline", className)}>
      {value}
    </a>
  ) : (
    <span className={className}>{value}</span>
  );
}
