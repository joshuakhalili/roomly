import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { planRetention } from "@/lib/retention";
import { RetentionControls } from "@/components/retention/retention-controls";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, Scale, Trash2, PauseCircle } from "lucide-react";

/**
 * Retention: the periods, what is due under them, and what has been erased.
 *
 * UK GDPR does not set a number anywhere — Article 5(1)(e) says personal
 * data may be kept "no longer than is necessary", and it is the controller's
 * job to decide what necessary means and be able to justify it. That is what
 * this page is: the justification, written down next to the rule it comes
 * from, and the evidence that it was actually followed.
 *
 * It reads through the same planner the cron job uses, so the list here is
 * the list that will be acted on rather than a description of it.
 */

const CATEGORY_KEY = {
  identity_documents: "retention.catIdentity",
  tenancy_records: "retention.catTenancy",
  inventory_photos: "retention.catPhotos",
} as const;

/**
 * Shortest legal period first, then the storage rule.
 *
 * Sorting on the number itself put "on export" at the front, because it is
 * stored as zero months — which reads as the strictest rule when it is
 * really the one with no legal period at all.
 */
const CATEGORY_ORDER: (keyof typeof CATEGORY_KEY)[] = [
  "identity_documents",
  "tenancy_records",
  "inventory_photos",
];

function formatMonths(
  months: number,
  t: (k: string, v?: Record<string, string | number>) => string,
) {
  if (months === 0) return t("retention.onExport");
  if (months % 12 === 0) return t("retention.years", { count: months / 12 });
  return t("retention.months", { count: months });
}

export default async function RetentionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const format = await getFormatter();

  const supabase = await createClient();

  const [{ data: rules }, { data: enabledRow }, { data: erasures }] =
    await Promise.all([
      supabase.from("retention_rules").select("*"),
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "retention_enabled")
        .maybeSingle(),
      supabase
        .from("data_erasures")
        .select("*")
        .eq("dry_run", false)
        .order("erased_at", { ascending: false })
        .limit(50),
    ]);

  const enabled = enabledRow?.value === "true";
  const plan = await planRetention(supabase);
  const dueRecords = plan.items.reduce((s, i) => s + i.records, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-6 shrink-0" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">{t("nav.retention")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("retention.subtitle")}
          </p>
        </div>
      </div>

      <RetentionControls enabled={enabled} dueRecords={dueRecords} />

      {/* ── The policy ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Scale className="size-5" aria-hidden />
          {t("retention.policy")}
        </h2>

        <div className="grid gap-3 lg:grid-cols-3">
          {CATEGORY_ORDER.map((key) => (rules ?? []).find((r) => r.category === key))
            .filter((rule) => rule !== undefined)
            .map((rule) => (
            <Card key={rule.category}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-medium">
                    {t(CATEGORY_KEY[rule.category as keyof typeof CATEGORY_KEY])}
                  </h3>
                  {rule.destruction_required && (
                    <Badge variant="destructive" className="text-xs">
                      {t("retention.mustDestroy")}
                    </Badge>
                  )}
                </div>

                <p className="text-2xl font-semibold tabular-nums">
                  {formatMonths(rule.period_months, t)}
                </p>
                {/* The database holds the authoritative English wording —
                    it is the policy record, and it is what the erasure log
                    is evidence against. The UI renders a translation of it,
                    so a Chinese-reading admin does not get an English clause
                    spliced into the middle of a Chinese sentence. */}
                <p className="text-xs text-muted-foreground">
                  {t("retention.from", {
                    clock: t(`retention.clock.${rule.category}`),
                  })}
                </p>

                {/* The whole point of the page — the rule, not just the number. */}
                <p className="mt-1 border-l-2 border-muted pl-3 text-xs leading-relaxed text-muted-foreground">
                  {t(`retention.basis.${rule.category}`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Due now ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trash2 className="size-5" aria-hidden />
          {t("retention.dueNow")}
          <Badge variant="secondary">{plan.items.length}</Badge>
        </h2>

        {plan.items.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("retention.nothingDue")}
          </p>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("retention.record")}</TableHead>
                    <TableHead>{t("retention.category")}</TableHead>
                    <TableHead>{t("retention.dueSince")}</TableHead>
                    <TableHead className="text-right">
                      {t("retention.rows")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("retention.files")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.items.map((item) => (
                    <TableRow key={`${item.subjectType}-${item.subjectId}`}>
                      <TableCell className="font-medium">
                        {item.subjectLabel}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {t(CATEGORY_KEY[item.category])}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.dueDate
                          ? format.dateTime(new Date(item.dueDate), {
                              dateStyle: "medium",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.records}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.files.length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </section>

      {/* ── Deliberately kept ───────────────────────────────────────────── */}
      {/* Shown rather than silently skipped: a record the job keeps passing
          over is exactly the thing that should be visible, since a hold left
          on indefinitely becomes its own retention breach. */}
      {plan.blocked.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <PauseCircle className="size-5" aria-hidden />
            {t("retention.onHold")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {plan.blocked.map((b) => (
              <Card key={b.reason}>
                <CardContent className="p-4">
                  <p className="text-lg font-semibold tabular-nums">{b.count}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      b.reason === "legal_hold"
                        ? "retention.heldLegal"
                        : "retention.heldNoEndDate",
                    )}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── What was actually erased ────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("retention.log")}</h2>
        <p className="text-sm text-muted-foreground">{t("retention.logHelp")}</p>

        {(erasures ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("retention.logEmpty")}
          </p>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("retention.record")}</TableHead>
                    <TableHead>{t("retention.erasedOn")}</TableHead>
                    <TableHead className="text-right">
                      {t("retention.rows")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("retention.files")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(erasures ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.subject_label}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format.dateTime(new Date(e.erased_at), {
                          dateStyle: "medium",
                        })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.records_deleted}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.files_deleted}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
