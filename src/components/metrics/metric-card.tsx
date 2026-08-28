import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { SparkArea } from "@/components/charts/spark-area";
import { cn } from "@/lib/utils";
import { TONE_TEXT, type Tone } from "@/lib/tone";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

/**
 * One number on the bento grid.
 *
 * Plain by default, and that is the design rather than the absence of one. An
 * earlier version washed each card in the colour of what it measured; six
 * coloured cards side by side turned a dashboard into a fairground, and none
 * of them was more urgent than any other so the colour said nothing.
 *
 * Now the card is white, the label is grey, the figure is black, and `tone` is
 * passed only when the number is something a person has to deal with. Two of
 * the six tiles use it, and only when their value is not zero — so the page is
 * quiet on a good day and the red is unmissable on a bad one.
 *
 * `size` still carries importance, which is the job it was always better at.
 */
export function MetricCard({
  label,
  value,
  hint,
  Icon,
  tone = "neutral",
  size = "default",
  muted = false,
  delta,
  footer,
  trend,
  href,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon: LucideIcon;
  /** Set only when this number needs acting on. Otherwise leave it neutral. */
  tone?: Tone;
  size?: "default" | "lg" | "xl";
  /** A zero that means everything is fine — drops any tone and recedes. */
  muted?: boolean;
  delta?: ReactNode;
  footer?: ReactNode;
  /** History for the background sparkline. Under two points, nothing is drawn. */
  trend?: number[];
  href?: string;
  className?: string;
}) {
  const active: Tone = muted ? "neutral" : tone;

  const body = (
    <Card
      interactive={Boolean(href)}
      className={cn("relative h-full", href && "group/metric")}
    >
      {trend && trend.length >= 2 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 opacity-25">
          <SparkArea values={trend} tone={active} />
        </div>
      )}

      <CardContent
        className={cn(
          "relative flex h-full flex-col gap-3",
          size === "xl" ? "p-6" : "p-5",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="metric-label">{label}</p>
          {/* A plain grey glyph, not a coloured chip. It labels the tile; it
              is not competing for attention with the number underneath it. */}
          <span className="relative flex size-4 shrink-0 items-center justify-center text-muted-foreground">
            <Icon
              className={cn(
                "size-4",
                href && "transition-opacity group-hover/metric:opacity-0",
              )}
              aria-hidden
            />
            {href && (
              <ArrowUpRight
                className="absolute size-4 text-foreground opacity-0 transition-opacity group-hover/metric:opacity-100"
                aria-hidden
              />
            )}
          </span>
        </div>

        <p
          className={cn(
            "figure",
            size === "xl"
              ? "figure-display"
              : size === "lg"
                ? "figure-lg"
                : "figure-stat",
            muted ? "font-medium text-muted-foreground" : TONE_TEXT[tone],
          )}
        >
          {value}
        </p>

        {hint && <p className="-mt-1 text-sm text-muted-foreground">{hint}</p>}

        {delta}

        {footer && <div className="mt-auto pt-2">{footer}</div>}
      </CardContent>
    </Card>
  );

  if (!href) return <div className={className}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {body}
    </Link>
  );
}
