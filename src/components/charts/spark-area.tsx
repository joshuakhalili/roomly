"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { TONE_VAR, type Tone } from "@/lib/tone";

/**
 * A small area chart, hatched rather than filled flat.
 *
 * The hatch is the reason this exists. A solid translucent fill under a line
 * is what every charting library produces by default, and it is what makes a
 * dashboard look bought rather than made. Diagonal ruling costs one `<pattern>`
 * and reads as drawn.
 *
 * No axes, no labels, no tooltip: it sits next to a figure that already says
 * what the number is, and its job is only to say which way it has been going.
 */
const W = 600;
const H = 120;

export function SparkArea({
  values,
  tone = "brand",
  className,
}: {
  values: number[];
  tone?: Tone;
  className?: string;
}) {
  /* Pattern ids are document-global, exactly like the gradient ids in the
     logo. Two sparklines on one page sharing one id means the second silently
     takes the first's fill. */
  const uid = useId().replace(/:/g, "");
  const hatch = `spark-hatch-${uid}`;

  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  /* A flat series has no range to normalise against; dividing by zero would
     put every point at NaN. Draw it down the middle instead. */
  const span = max - min || 1;
  const pad = 6;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`)
    .join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const colour = TONE_VAR[tone];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <pattern
          id={hatch}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-40)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            stroke={colour}
            strokeWidth="1.6"
            opacity="0.4"
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
      </defs>

      <path d={area} fill={`url(#${hatch})`} />
      <path
        d={line}
        fill="none"
        stroke={colour}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
