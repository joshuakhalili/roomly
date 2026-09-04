import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ExpensesBrowser } from "@/components/expenses/expenses-browser";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { recentTaxYears } from "@/lib/tax-year";
import { Receipt } from "lucide-react";
import type {
  Expense,
  ExpenseCategory,
  ExpenseLedgerRow,
  Property,
  Room,
} from "@/lib/types";

/**
 * Everything that cost money, from wherever it was entered.
 *
 * Reads the expense_ledger view rather than the expenses table: a maintenance
 * job's cost and a washing machine's purchase price are spend too, and they
 * already live in their own tables. The view unions the four sources so this
 * page shows the whole picture without any row being stored twice.
 */
export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const [
    { data: ledger },
    { data: expenses },
    { data: categories },
    { data: properties },
    { data: rooms },
  ] = await Promise.all([
    supabase.from("expense_ledger").select("*"),
    supabase.from("expenses").select("*"),
    supabase
      .from("expense_categories")
      .select("*")
      .eq("is_archived", false)
      .order("sort_order"),
    supabase.from("properties").select("*").order("name"),
    supabase.from("rooms").select("*").order("name"),
  ]);

  const rows = (ledger ?? []) as ExpenseLedgerRow[];
  const categoryList = (categories ?? []) as ExpenseCategory[];
  const propertyList = (properties ?? []) as Property[];
  const roomList = (rooms ?? []) as Room[];

  /* Offer only years there is anything to look at, plus the current one — a
     dropdown of empty years is a list of dead ends. */
  const earliest = rows.reduce<string | null>(
    (min, r) => (!min || (r.spent_on && r.spent_on < min) ? r.spent_on : min),
    null,
  );
  const yearsBack = earliest
    ? new Date().getFullYear() - Number(earliest.slice(0, 4)) + 1
    : 1;
  const years = recentTaxYears(Math.min(Math.max(yearsBack, 1), 10));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("expenses.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("expenses.subtitle")}
          </p>
        </div>
        <ExpenseDialog
          categories={categoryList}
          properties={propertyList}
          rooms={roomList}
        />
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Receipt className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {t("expenses.none")}
            </p>
            <ExpenseDialog
              categories={categoryList}
              properties={propertyList}
              rooms={roomList}
            />
          </CardContent>
        </Card>
      ) : (
        <ExpensesBrowser
          rows={rows}
          expenses={(expenses ?? []) as Expense[]}
          categories={categoryList}
          properties={propertyList}
          rooms={roomList}
          years={years}
        />
      )}
    </div>
  );
}
