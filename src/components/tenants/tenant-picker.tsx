"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TenantDialog } from "./tenant-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Plus, Search, X } from "lucide-react";
import type { Tenant } from "@/lib/types";

/**
 * Chooses which existing tenant profiles are on a tenancy.
 *
 * Assigning rather than re-typing is the point: someone who has rented
 * before keeps their details and their passport, and moving them into a new
 * room is a couple of clicks.
 */
export function TenantPicker({
  tenants,
  selectedIds,
  leadId,
  onChange,
  onLeadChange,
  disabled,
}: {
  tenants: Tenant[];
  selectedIds: string[];
  leadId: string | null;
  onChange: (ids: string[]) => void;
  onLeadChange: (id: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState("");

  const selected = selectedIds
    .map((id) => tenants.find((x) => x.id === id))
    .filter((x): x is Tenant => Boolean(x));

  const q = query.trim().toLowerCase();
  const available = tenants.filter(
    (person) =>
      !person.is_archived &&
      !selectedIds.includes(person.id) &&
      (q === "" ||
        `${person.first_name} ${person.surname}`.toLowerCase().includes(q) ||
        (person.phone ?? "").includes(q)),
  );

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Chosen people, and which of them leads. */}
      {selected.length > 0 && (
        <ul className="flex flex-col gap-2">
          {selected.map((person) => (
            <li key={person.id}>
              <Card>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {person.first_name} {person.surname}
                    </p>
                    {person.phone && (
                      <p className="truncate text-xs text-muted-foreground">
                        {person.phone}
                      </p>
                    )}
                  </div>

                  <label className="flex shrink-0 items-center gap-1.5 text-xs">
                    <input
                      type="radio"
                      name="lead_tenant_id"
                      value={person.id}
                      checked={leadId === person.id}
                      onChange={() => onLeadChange(person.id)}
                      disabled={disabled}
                      className="size-3.5"
                    />
                    {t("tenancy.leadTenant")}
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggle(person.id)}
                    disabled={disabled}
                    aria-label={t("common.delete")}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </CardContent>
              </Card>
              <input type="hidden" name="tenant_ids" value={person.id} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("tenants.search")}
              className="pl-8"
              disabled={disabled}
              aria-label={t("tenants.search")}
            />
          </div>
          {/* New arrivals get a profile without leaving the form. */}
          <TenantDialog
            onCreated={(id) => onChange([...selectedIds, id])}
            trigger={
              <Button type="button" variant="outline" size="sm" disabled={disabled}>
                <Plus className="size-4" aria-hidden />
                {t("tenants.new")}
              </Button>
            }
          />
        </div>

        {available.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            {tenants.length === 0
              ? t("tenants.noTenants")
              : t("filters.noResults")}
          </p>
        ) : (
          <ul className="max-h-56 overflow-y-auto">
            {available.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => toggle(person.id)}
                  disabled={disabled}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm",
                    "hover:bg-accent disabled:opacity-50",
                  )}
                >
                  <Checkbox checked={false} className="pointer-events-none" />
                  <span className="min-w-0 flex-1 truncate">
                    {person.first_name} {person.surname}
                  </span>
                  {person.preferred_language === "zh" && (
                    <Badge variant="outline" className="shrink-0 text-xs">
                      中文
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
