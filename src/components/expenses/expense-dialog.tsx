"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { saveExpense } from "@/lib/actions/expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FormError } from "@/components/ui/field";
import { OptionSelect } from "@/components/ui/option-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import type {
  Expense,
  ExpenseCategory,
  Property,
  Room,
} from "@/lib/types";

/* Radix cannot hold an empty string, so "not allocated" needs a real value
   that is stripped before the form reaches the server. */
const NONE = "__none__";
const WHOLE_PROPERTY = "__whole_property__";

export function ExpenseDialog({
  expense,
  categories,
  properties,
  rooms,
  trigger,
}: {
  expense?: Expense;
  categories: ExpenseCategory[];
  properties: Property[];
  rooms: Room[];
  trigger?: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  /* Controlled so the room list can follow it. Picking a room in a building
     you are no longer allocating to would file the expense against a room
     whose property says something different. */
  const [propertyId, setPropertyId] = useState(
    expense?.property_id ?? NONE,
  );

  const roomsHere = rooms.filter((r) => r.property_id === propertyId);

  function submit(formData: FormData) {
    setError(null);
    for (const key of ["property_id", "room_id", "category_id"]) {
      const value = formData.get(key);
      if (value === NONE || value === WHOLE_PROPERTY) formData.set(key, "");
    }
    startTransition(async () => {
      const result = await saveExpense(expense?.id ?? null, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(t("common.saved"));
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={expense ? "ghost" : "default"}>
            {expense ? (
              <Pencil className="size-4" aria-hidden />
            ) : (
              <>
                <Plus className="size-4" aria-hidden />
                {t("expenses.add")}
              </>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {expense ? t("expenses.edit") : t("expenses.add")}
          </DialogTitle>
        </DialogHeader>

        <form action={submit} className="flex flex-col gap-4">
          <Field label={t("expenses.description")} required>
            <Input
              name="description"
              defaultValue={expense?.description ?? ""}
              placeholder={t("expenses.descriptionPlaceholder")}
              required
              autoFocus
              disabled={isPending}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("expenses.amount")} required>
              <Input
                type="number"
                step="0.01"
                min="0"
                name="amount"
                defaultValue={expense?.amount ?? ""}
                required
                disabled={isPending}
              />
            </Field>

            <Field label={t("expenses.spentOn")} required>
              <Input
                type="date"
                name="spent_on"
                defaultValue={expense?.spent_on ?? ""}
                required
                disabled={isPending}
              />
            </Field>

            <Field label={t("expenses.category")}>
              <OptionSelect
                name="category_id"
                defaultValue={expense?.category_id ?? NONE}
                disabled={isPending}
                options={[
                  { value: NONE, label: t("common.notSet") },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>

            <Field label={t("expenses.supplier")}>
              <Input
                name="supplier_name"
                defaultValue={expense?.supplier_name ?? ""}
                disabled={isPending}
              />
            </Field>

            <Field
              label={t("properties.one")}
              hint={t("expenses.allocationHint")}
            >
              <OptionSelect
                name="property_id"
                value={propertyId}
                onValueChange={setPropertyId}
                disabled={isPending}
                options={[
                  { value: NONE, label: t("expenses.wholeBusiness") },
                  ...properties.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </Field>

            {/* Only once a building is chosen — a room list with nothing to
                choose from is a control that cannot be used. */}
            {propertyId !== NONE && roomsHere.length > 0 && (
              <Field label={t("rooms.one")}>
                <OptionSelect
                  name="room_id"
                  defaultValue={expense?.room_id ?? WHOLE_PROPERTY}
                  disabled={isPending}
                  options={[
                    {
                      value: WHOLE_PROPERTY,
                      label: t("expenses.wholeProperty"),
                    },
                    ...roomsHere.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                />
              </Field>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_recharged"
              name="is_recharged"
              defaultChecked={expense?.is_recharged ?? false}
              disabled={isPending}
            />
            <Label htmlFor="is_recharged" className="font-normal">
              {t("expenses.isRecharged")}
            </Label>
          </div>

          <Field label={t("tenancy.notes")}>
            <Textarea
              name="notes"
              rows={2}
              defaultValue={expense?.notes ?? ""}
              disabled={isPending}
            />
          </Field>

          <FormError message={error} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
