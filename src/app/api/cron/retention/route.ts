import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { runRetention } from "@/lib/retention";

/**
 * The retention job.
 *
 * Kept separate from the daily job on purpose. That one advances statuses
 * and raises alerts — if it throws halfway through, you re-run it. This one
 * deletes things permanently, and a job that cannot be safely re-run should
 * not share a failure path with one that can.
 *
 * It starts every run as a preview and only deletes if `retention_enabled`
 * is switched on, so the schedule can be live long before the deletion is.
 *
 * `?dry_run=1` forces a preview regardless — that is what the Retention
 * page calls to show what is coming.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`)
    return new NextResponse("Unauthorised", { status: 401 });

  const db = createAdminClient();

  const { data: enabledRow } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "retention_enabled")
    .maybeSingle();

  const forced = new URL(request.url).searchParams.get("dry_run") === "1";
  const dryRun = forced || enabledRow?.value !== "true";

  const result = await runRetention(db, { dryRun });

  return NextResponse.json({
    ok: true,
    mode: dryRun ? "preview" : "live",
    ...result,
    // The full item list can be long and every label is deliberately
    // non-identifying, so it is safe to return — but the summary is what
    // anyone reading a cron log actually wants.
    items: result.items.map((i) => ({
      category: i.category,
      subject: i.subjectType,
      label: i.subjectLabel,
      dueDate: i.dueDate,
      records: i.records,
      files: i.files.length,
    })),
  });
}
