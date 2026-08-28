import { cn } from "@/lib/utils";
import { TONE_VAR, type Tone } from "@/lib/tone";

/**
 * Occupancy as one segment per room, rather than one bar for all of them.
 *
 * A 78% bar is a number drawn twice. Thirty ticks with seven of them empty is
 * a different piece of information: you can count the empty ones, and the eye
 * does it without being asked. That literalness is the whole point — it is
 * only possible because the portfolio is small enough for one mark per room.
 *
 * Above `MAX_SEGMENTS` the ticks are thinner than the gaps between them and
 * the pattern turns to noise, so it falls back to a proportional bar.
 */
const MAX_SEGMENTS = 48;

export function SegmentMeter({
  total,
  filled,
  tone = "brand",
  className,
}: {
  total: number;
  filled: number;
  tone?: Tone;
  className?: string;
}) {
  if (total <= 0) return null;

  const safeFilled = Math.max(0, Math.min(filled, total));
  const colour = TONE_VAR[tone];

  if (total > MAX_SEGMENTS) {
    return <ProgressMeter value={safeFilled} max={total} tone={tone} className={className} />;
  }

  return (
    <div className={cn("flex h-2 w-full items-stretch gap-[3px]", className)}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "min-w-px flex-1 rounded-[1px]",
            i >= safeFilled && "meter-track bg-foreground/6",
          )}
          style={i < safeFilled ? { background: colour } : undefined}
        />
      ))}
    </div>
  );
}

/**
 * The proportional version, for anything measured in money rather than rooms.
 *
 * Segments would be a lie here: £4,200 of £5,950 is not four things out of six,
 * and drawing it as ticks invites counting something that cannot be counted.
 *
 * The fill is striped and the track is ruled. That texture is doing the work a
 * second colour would otherwise have to: filled and unfilled are told apart by
 * their surface, so the meter needs only one hue instead of two.
 */
export function ProgressMeter({
  value,
  max,
  tone = "brand",
  className,
}: {
  value: number;
  max: number;
  tone?: Tone;
  className?: string;
}) {
  if (max <= 0) return null;
  const share = Math.max(0, Math.min(100, (value / max) * 100));
  const colour = TONE_VAR[tone];

  return (
    <div
      className={cn(
        "meter-track h-2 w-full overflow-hidden rounded-full bg-foreground/6",
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width] duration-(--duration-slow) ease-(--ease-out)"
        style={{
          width: `${share}%`,
          backgroundColor: colour,
          // Lighter diagonal ruling over the fill, matching the track's angle.
          backgroundImage:
            "repeating-linear-gradient(-45deg, oklch(1 0 0 / 0.22) 0 3px, transparent 3px 7px)",
        }}
      />
    </div>
  );
}
