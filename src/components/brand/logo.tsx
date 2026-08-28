import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The Roomly mark: a room, with light coming through the doorway.
 *
 * Drawn as SVG paths rather than shipped as an image. That is the right medium
 * for a software mark, not a compromise — one source scales from a 16px favicon
 * to a 512px app icon, the frame picks up the current text colour so it works
 * in both themes without a second file, and every generated icon size comes
 * from here so they cannot drift apart.
 *
 * The gradient inside the door is the same violet → magenta → orange as the
 * page background, so the identity and the atmosphere are one idea rather than
 * two that happen to sit next to each other.
 */

export function Logo({
  variant = "mark",
  className,
  ...props
}: {
  /** `mark` is the square symbol; `lockup` adds the wordmark beside it. */
  variant?: "mark" | "lockup";
  className?: string;
} & Omit<React.SVGProps<SVGSVGElement>, "className">) {
  /**
   * SVG gradient ids are global to the document. Two logos on one page sharing
   * an id means the second silently inherits the first's fill — and the header
   * plus a settings page preview is exactly that case. useId() keeps them apart.
   */
  const uid = useId().replace(/:/g, "");
  const doorGradient = `roomly-door-${uid}`;
  const glowGradient = `roomly-glow-${uid}`;

  const defs = (
    <defs>
      <linearGradient id={doorGradient} x1="0" y1="1" x2="0.35" y2="0">
        <stop offset="0%" stopColor="var(--brand-grad-1)" />
        <stop offset="52%" stopColor="var(--brand-grad-2)" />
        <stop offset="100%" stopColor="var(--brand-grad-3)" />
      </linearGradient>
      {/* Spill onto the floor — what makes it read as light rather than as a
          coloured rectangle. */}
      <radialGradient id={glowGradient} cx="0.5" cy="1" r="0.75">
        <stop offset="0%" stopColor="var(--brand-grad-2)" stopOpacity="0.55" />
        <stop offset="100%" stopColor="var(--brand-grad-2)" stopOpacity="0" />
      </radialGradient>
    </defs>
  );

  const mark = (
    <>
      {defs}
      {/* Room: a rounded square, open at the bottom where the doorway sits. */}
      <path
        d="M6 27V11a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <path d="M6 27h20" stroke={`url(#${glowGradient})`} strokeWidth="5" />
      {/* Doorway. Sits on the floor line so the two read as one silhouette. */}
      <path
        d="M11.75 27v-8.25a4.25 4.25 0 0 1 8.5 0V27Z"
        fill={`url(#${doorGradient})`}
      />
      <path
        d="M6 27h3.75M22.25 27H26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
    </>
  );

  if (variant === "lockup") {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <svg
          viewBox="0 0 32 32"
          role="img"
          aria-label="Roomly"
          className="size-7 shrink-0"
          {...props}
        >
          {mark}
        </svg>
        <span className="text-[1.0625rem] font-semibold tracking-tight">
          Roomly
        </span>
      </span>
    );
  }

  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Roomly"
      className={cn("size-7", className)}
      {...props}
    >
      {mark}
    </svg>
  );
}

/**
 * The small-size mark, for favicons and anything under ~24px.
 *
 * Not the full mark scaled down: at 16px the 2.75 stroke closes up the doorway
 * and the whole thing turns into a filled blob. This version has a heavier
 * stroke, a proportionally larger door and no floor glow — the details that
 * only exist to be seen large are removed rather than compressed.
 */
export function LogoCompact({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const doorGradient = `roomly-door-sm-${uid}`;

  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Roomly"
      className={cn("size-4", className)}
    >
      <defs>
        <linearGradient id={doorGradient} x1="0" y1="1" x2="0.35" y2="0">
          <stop offset="0%" stopColor="var(--brand-grad-1)" />
          <stop offset="52%" stopColor="var(--brand-grad-2)" />
          <stop offset="100%" stopColor="var(--brand-grad-3)" />
        </linearGradient>
      </defs>
      <path
        d="M5 27V11a6 6 0 0 1 6-6h10a6 6 0 0 1 6 6v16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M11.5 27v-8a4.5 4.5 0 0 1 9 0v8Z" fill={`url(#${doorGradient})`} />
      <path
        d="M5 27h4M23 27h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
