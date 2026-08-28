import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "↗ £340 · vs 30 days ago" — the comparison that turns a number into news.
 *
 * `polarity` exists because up is not universally good. Occupancy rising is
 * green; overdue rent rising is red; both are the same arrow. Colouring by
 * direction alone would tell the reader the opposite of the truth on half the
 * tiles here, so every caller has to say which way is which.
 *
 * The magnitude arrives pre-formatted. Currency, percentage points and plain
 * counts all end up in this badge, and `next-intl`'s formatter lives on the
 * server — so the parent formats and this component only decides the colour.
 */
export function DeltaBadge({
  delta,
  label,
  caption,
  polarity,
}: {
  /** Raw signed change — only its sign is read, for direction. */
  delta: number;
  /** The magnitude, already formatted and unsigned. */
  label: string;
  /** What the comparison is against, e.g. "vs 30 days ago". */
  caption: string;
  polarity: "up-good" | "up-bad";
}) {
  const direction = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const Icon =
    direction === "flat"
      ? Minus
      : direction === "up"
        ? ArrowUpRight
        : ArrowDownRight;

  const good =
    direction === "flat"
      ? null
      : (direction === "up") === (polarity === "up-good");

  /* The chip sits on a card that may already be tinted, so it stays nearly
     opaque rather than translucent — a soft green on a soft green is a smear.
     Green and red here are about the *direction being good or bad*, which is a
     different question from what the card measures, so they do not follow the
     card's tone. */
  const tone =
    good === null
      ? "bg-muted text-muted-foreground"
      : good
        ? "bg-success-muted text-success"
        : "bg-destructive-muted text-destructive";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={cn(
          "figure inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
          tone,
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </div>
  );
}
