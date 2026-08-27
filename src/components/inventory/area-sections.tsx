"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { addSection, deleteSection } from "@/lib/actions/inventory";
import { SectionEditor } from "./section-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, SlidersHorizontal, X } from "lucide-react";
import type { ChecklistPhoto, ChecklistSection } from "@/lib/types";

/**
 * The sections inside one area, with the controls to tailor them.
 *
 * Templates only get a room most of the way there. A bathroom with no
 * window shouldn't carry a Windows section to scroll past, and a bathroom
 * that happens to have wall fixtures needs one that no template would
 * predict. Both are one click here.
 *
 * "Tailor" mode exists so several unwanted sections can be cleared in one
 * pass without a confirmation dialog for each — removing an empty section
 * costs nothing, and doing it 6 times through modals would be miserable.
 */
export function AreaSections({
  areaId,
  sections,
  photosBySection,
  readOnly,
}: {
  areaId: string;
  sections: ChecklistSection[];
  photosBySection: Map<string, ChecklistPhoto[]>;
  readOnly: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tailoring, setTailoring] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeChosen() {
    startTransition(async () => {
      for (const id of chosen) {
        const result = await deleteSection(id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
      }
      toast.success(t("common.saved"));
      setChosen(new Set());
      setTailoring(false);
      router.refresh();
    });
  }

  function onAdd() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await addSection(areaId, name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNewName("");
      setAdding(false);
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  // A section holding photos or ratings is real work — warn before losing it.
  const chosenWithContent = [...chosen].filter((id) => {
    const s = sections.find((x) => x.id === id);
    return (
      (photosBySection.get(id)?.length ?? 0) > 0 ||
      s?.condition_rating ||
      s?.description
    );
  }).length;

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={tailoring ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTailoring(!tailoring);
              setChosen(new Set());
            }}
            disabled={isPending}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {tailoring ? t("common.done") : t("inventory.tailor")}
          </Button>

          {!tailoring && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAdding(true)}
              disabled={isPending}
            >
              <Plus className="size-4" aria-hidden />
              {t("inventory.addSection")}
            </Button>
          )}

          {tailoring && chosen.size > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={removeChosen}
              disabled={isPending}
            >
              <Trash2 className="size-4" aria-hidden />
              {t("inventory.removeSelected", { count: chosen.size })}
            </Button>
          )}
        </div>
      )}

      {tailoring && (
        <p className="text-xs text-muted-foreground">
          {t("inventory.tailorHint")}
        </p>
      )}

      {chosenWithContent > 0 && (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t("inventory.removeWarning", { count: chosenWithContent })}
        </p>
      )}

      {adding && (
        <Card>
          <CardContent className="flex flex-col gap-2 p-3 sm:flex-row">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAdd();
                }
              }}
              placeholder={t("inventory.sectionNamePlaceholder")}
              autoFocus
              disabled={isPending}
              aria-label={t("inventory.addSection")}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={onAdd} disabled={isPending}>
                {t("common.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                }}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tailoring ? (
        // Compact list while tailoring: the job is choosing what to keep,
        // not filling anything in.
        <ul className="flex flex-col gap-1">
          {sections.map((section) => {
            const photoCount = photosBySection.get(section.id)?.length ?? 0;
            return (
              <li key={section.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-accent">
                  <Checkbox
                    checked={chosen.has(section.id)}
                    onCheckedChange={() => toggle(section.id)}
                    disabled={isPending}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {section.section_name}
                  </span>
                  {section.is_custom && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {t("inventory.custom")}
                    </Badge>
                  )}
                  {photoCount > 0 && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {photoCount}
                    </Badge>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        sections.map((section) => (
          <SectionEditor
            key={section.id}
            section={section}
            photos={photosBySection.get(section.id) ?? []}
          />
        ))
      )}
    </div>
  );
}
