import { BRAND_MARK_PATHS } from "@/lib/brand-mark";
import { cn } from "@/lib/utils";

/**
 * CPBoard mark: the "CPB" circle monogram (see `src/lib/brand-mark.ts`).
 * C and B use the foreground colour and P the primary red, so the mark follows
 * the theme; the background stays transparent.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <g fillRule="evenodd">
        <path fill="var(--foreground)" d={BRAND_MARK_PATHS.c} />
        <path fill="var(--primary)" d={BRAND_MARK_PATHS.p} />
        <path fill="var(--foreground)" d={BRAND_MARK_PATHS.b} />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[15px] font-semibold tracking-tight">CPBoard</span>
    </span>
  );
}
