"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ConditionRating } from "@/lib/types";

const RATINGS: ConditionRating[] = [
  "excellent",
  "good",
  "fair",
  "poor",
  "unacceptable",
];

const LABEL_KEY: Record<ConditionRating, string> = {
  excellent: "inventory.excellent",
  good: "inventory.good",
  fair: "inventory.fair",
  poor: "inventory.poor",
  unacceptable: "inventory.unacceptable",
};

/** Green through red, matching how the reference reports colour their badges. */
const SELECTED_STYLE: Record<ConditionRating, string> = {
  excellent: "bg-success text-success-foreground border-success",
  good: "bg-success text-success-foreground border-success",
  fair: "bg-warning text-warning-foreground border-warning",
  poor: "bg-caution text-caution-foreground border-caution",
  unacceptable: "bg-destructive text-destructive-foreground border-destructive",
};

/**
 * The condition/cleanliness picker.
 *
 * A pill row rather than a dropdown: this is used on every section of every
 * area — potentially hundreds of times per report — usually one-handed while
 * standing in the room. One tap beats open-scroll-select every time.
 */
export function RatingPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: ConditionRating | null;
  onChange: (rating: ConditionRating) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {RATINGS.map((rating) => {
          const selected = value === rating;
          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(rating)}
              className={cn(
                // min-h-9 keeps every pill a comfortable tap target on a phone.
                "min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? SELECTED_STYLE[rating]
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              {t(LABEL_KEY[rating])}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only badge for the same scale, used in summaries and comparisons. */
export function RatingBadge({ value }: { value: ConditionRating | null }) {
  const t = useTranslations();
  if (!value)
    return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        SELECTED_STYLE[value],
      )}
    >
      {t(LABEL_KEY[value])}
    </span>
  );
}
