import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * A single headline number on the dashboard.
 *
 * `tone` colours the value only when something needs attention — a red
 * number should mean "act on this", so a zero overdue balance stays neutral
 * rather than shouting green.
 */
export function MetricCard({
  label,
  value,
  hint,
  Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon: LucideIcon;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-metric-label">{label}</p>
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <p
          className={cn(
            "text-figure text-stat mt-2",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-destructive",
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
