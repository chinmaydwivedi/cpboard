import { cn } from "@/lib/utils";

/**
 * Shared title block for top-level pages, so every page opens the same way:
 * a small mono eyebrow, the serif display title, and a muted description.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  tour,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** `data-tour` target used by the page walkthrough. */
  tour?: string;
  /** Optional content rendered to the right of the title on wide screens. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
      data-tour={tour}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="font-heading text-4xl leading-[1.05] tracking-tight italic sm:text-[2.75rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
