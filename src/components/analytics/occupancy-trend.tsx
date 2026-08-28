"use client";

import { useTranslations, useFormatter } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";

interface Point {
  date: string;
  occupancy: number;
  rent: number;
  overdue: number;
}

/**
 * Occupancy over time, drawn as inline SVG.
 *
 * A charting library would be several hundred kilobytes for two lines on
 * one page. This is a sparkline-style area chart built from the same data,
 * with the numbers stated alongside so the exact values are readable rather
 * than estimated off an axis.
 */
export function OccupancyTrend({ points }: { points: Point[] }) {
  const t = useTranslations();
  const format = useFormatter();

  const width = 600;
  const height = 140;
  const pad = 4;

  const xs = (i: number) =>
    pad + (i / Math.max(1, points.length - 1)) * (width - pad * 2);
  // Occupancy is a percentage, so the scale is fixed 0–100 rather than
  // fitted to the data — a jump from 90% to 95% shouldn't look dramatic.
  const ys = (v: number) => height - pad - (v / 100) * (height - pad * 2);

  const line = points.map((p, i) => `${xs(i)},${ys(p.occupancy)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${xs(points.length - 1)},${height - pad}`;

  const latest = points[points.length - 1];
  const first = points[0];
  const change = latest.occupancy - first.occupancy;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <div>
            <p className="text-metric-label">
              {t("analytics.occupancyOverTime")}
            </p>
            <p className="text-figure text-stat">
              {latest.occupancy}%
            </p>
          </div>
          {change !== 0 && (
            <span
              className={
                change > 0
                  ? "text-sm text-emerald-600"
                  : "text-sm text-destructive"
              }
            >
              {change > 0 ? "+" : ""}
              {change}%
            </span>
          )}
          <div className="ml-auto text-right">
            <p className="text-metric-label">
              {t("analytics.rentRoll")}
            </p>
            <p className="text-figure text-lg font-bold">
              {format.number(latest.rent, {
                style: "currency",
                currency: "GBP",
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-32 w-full"
          role="img"
          aria-label={`${t("analytics.occupancyOverTime")}: ${latest.occupancy}%`}
          preserveAspectRatio="none"
        >
          <polygon points={area} className="fill-primary/10" />
          <polyline
            points={line}
            className="stroke-primary"
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </CardContent>
    </Card>
  );
}
