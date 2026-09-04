import { cn } from "@/lib/utils";

/**
 * The Roomly mark: a door, mid-swing — the plan-view symbol for a doorway
 * rather than a house seen from outside. Every competitor in the category
 * draws an elevation (a house outline) or a letterform; a plan-view mark is
 * the one form that is both unclaimed in this category and specific to what
 * the app actually manages — rooms, and who can get into them.
 *
 * Two filled shapes, no stroke and no gradient. A stroked mark is nearly all
 * edge pixel, so it turns to grey wash below ~24px — the old mark measured
 * 25% fully-solid ink at a 16px favicon. A filled silhouette carries far more
 * interior (non-anti-aliased) pixels at the same size, which is what actually
 * survives a browser tab.
 *
 * `currentColor` throughout, so the mark inherits whatever text colour it
 * sits in — ink on bone, bone on ink — and needs no dark-mode branch.
 */
const MARK_PATHS = [
  "M4 5h5v22H4Z",
  "M9 9a18 18 0 0 1 18 18h-5A13 13 0 0 0 9 14V9Z",
] as const;

function MarkPaths() {
  return (
    <>
      {MARK_PATHS.map((d) => (
        <path key={d} fill="currentColor" d={d} />
      ))}
    </>
  );
}

export function Logo({
  variant = "mark",
  className,
  ...props
}: {
  /** `mark` is the symbol alone; `lockup` adds the wordmark beside it. */
  variant?: "mark" | "lockup";
  className?: string;
} & Omit<React.SVGProps<SVGSVGElement>, "className">) {
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
          <MarkPaths />
        </svg>
        {/* Archivo, expanded and heavy — the one place in the app the display
            face carries width as well as weight. font-variation-settings is
            used directly rather than a Tailwind class because the wdth axis
            has no utility of its own in this project's token layer. */}
        <span
          className="font-display text-[1.125rem] font-extrabold tracking-tight"
          style={{ fontVariationSettings: "'wdth' 118" }}
        >
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
      <MarkPaths />
    </svg>
  );
}

/**
 * Alias of the mark for call sites under ~24px — kept as a separate export
 * because the old stroke-based mark genuinely needed different geometry at
 * small sizes. This one does not: it was designed filled, so it is already
 * the small-size version. Kept so a future favicon/icon call site has an
 * obvious name to reach for without re-deriving this reasoning.
 */
export function LogoCompact({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Roomly"
      className={cn("size-4", className)}
    >
      <MarkPaths />
    </svg>
  );
}
