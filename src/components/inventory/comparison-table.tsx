"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RatingBadge } from "./rating-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CONDITION_ORDER } from "@/lib/types";
import { TrendingDown, Minus, TrendingUp } from "lucide-react";
import type {
  ChecklistArea,
  ChecklistSection,
  ConditionRating,
} from "@/lib/types";

type Change = "worsened" | "unchanged" | "improved" | "incomplete";

/**
 * Compares a rating pair by position on the scale, so "Good → Fair" is a
 * drop and "Fair → Good" is an improvement. Anything unrated is incomplete
 * rather than silently counted as unchanged.
 */
function compare(
  before: ConditionRating | null,
  after: ConditionRating | null,
): Change {
  if (!before || !after) return "incomplete";
  const a = CONDITION_ORDER.indexOf(before);
  const b = CONDITION_ORDER.indexOf(after);
  if (b < a) return "worsened";
  if (b > a) return "improved";
  return "unchanged";
}

const CHANGE_ICON = {
  worsened: TrendingDown,
  improved: TrendingUp,
  unchanged: Minus,
  incomplete: Minus,
} as const;

const CHANGE_STYLE: Record<Change, string> = {
  worsened: "text-destructive",
  improved: "text-emerald-600",
  unchanged: "text-muted-foreground",
  incomplete: "text-muted-foreground",
};

export function ComparisonTable({
  checkInId,
  checkOutId,
  areas,
  sections,
}: {
  checkInId: string;
  checkOutId: string;
  areas: ChecklistArea[];
  sections: ChecklistSection[];
}) {
  const t = useTranslations();
  const [onlyChanges, setOnlyChanges] = useState(true);

  const inAreas = areas.filter((a) => a.checklist_id === checkInId);
  const outAreas = areas.filter((a) => a.checklist_id === checkOutId);

  const rows = inAreas.flatMap((inArea) => {
    // Areas are matched by name: both checklists were scaffolded from the
    // same templates, and the name is what an admin actually sees.
    const outArea = outAreas.find((a) => a.name === inArea.name);
    const inSections = sections.filter((s) => s.checklist_area_id === inArea.id);

    return inSections.map((inSection) => {
      const outSection = outArea
        ? sections.find(
            (s) =>
              s.checklist_area_id === outArea.id &&
              s.section_name === inSection.section_name,
          )
        : undefined;

      return {
        areaName: inArea.name,
        sectionName: inSection.section_name,
        before: inSection,
        after: outSection,
        conditionChange: compare(
          inSection.condition_rating,
          outSection?.condition_rating ?? null,
        ),
        cleanlinessChange: compare(
          inSection.cleanliness_rating,
          outSection?.cleanliness_rating ?? null,
        ),
      };
    });
  });

  const flagged = rows.filter(
    (r) => r.conditionChange === "worsened" || r.cleanlinessChange === "worsened",
  );
  const visible = onlyChanges ? flagged : rows;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div>
            <p className="text-2xl font-semibold text-destructive tabular-nums">
              {flagged.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("inventory.worsened")}
            </p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{rows.length}</p>
            <p className="text-xs text-muted-foreground">
              {t("inventory.sections")}
            </p>
          </div>
          <Button
            variant={onlyChanges ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyChanges(!onlyChanges)}
            className="ml-auto"
          >
            {onlyChanges ? t("filters.all") : t("inventory.worsened")}
          </Button>
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {onlyChanges ? t("inventory.noDeterioration") : t("filters.noResults")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((row, i) => {
            const Icon = CHANGE_ICON[row.conditionChange];
            return (
              <li key={`${row.areaName}-${row.sectionName}-${i}`}>
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`size-4 shrink-0 ${CHANGE_STYLE[row.conditionChange]}`}
                        aria-hidden
                      />
                      <span className="font-medium">{row.sectionName}</span>
                      <Badge variant="outline" className="text-xs">
                        {row.areaName}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">
                          {t("inventory.checkIn")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <RatingBadge value={row.before.condition_rating} />
                          <RatingBadge value={row.before.cleanliness_rating} />
                        </div>
                        {row.before.description && (
                          <p className="text-xs text-muted-foreground">
                            {row.before.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">
                          {t("inventory.checkOut")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <RatingBadge
                            value={row.after?.condition_rating ?? null}
                          />
                          <RatingBadge
                            value={row.after?.cleanliness_rating ?? null}
                          />
                        </div>
                        {row.after?.description && (
                          <p className="text-xs text-muted-foreground">
                            {row.after.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
