import { cn } from "@/lib/utils";

/**
 * CPBoard mark: code brackets around a podium, with the champion on top.
 * Flat fills use theme tokens so the mark follows the site palette; the
 * standalone app icons live in `src/app/icon.svg` and `public/icon-*.png`.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <rect width="512" height="512" rx="116" fill="var(--card)" />
      <rect
        x="4"
        y="4"
        width="504"
        height="504"
        rx="112"
        fill="none"
        stroke="var(--border)"
        strokeWidth="8"
      />
      <path
        d="M130 200 76 256l54 56M382 200l54 56-54 56"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.5"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="152" y="266" width="60" height="104" rx="12" fill="var(--foreground)" fillOpacity="0.92" />
      <rect x="226" y="200" width="60" height="170" rx="12" fill="var(--primary)" />
      <rect x="300" y="302" width="60" height="68" rx="12" fill="var(--foreground)" fillOpacity="0.5" />
      <circle cx="256" cy="152" r="25" fill="var(--primary)" />
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
