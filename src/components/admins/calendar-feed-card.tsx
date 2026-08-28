"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { regenerateCalendarToken } from "@/lib/actions/admins";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDelete } from "@/components/ui/confirm-delete";
import { CalendarDays, Copy, RefreshCw, TriangleAlert } from "lucide-react";
import type { Profile } from "@/lib/types";

/**
 * The admin's personal calendar subscription link.
 *
 * Subscribing in a phone's own calendar app is how move-in, move-out and
 * rent alerts actually reach someone — no push infrastructure, using
 * notifications people already trust.
 */
export function CalendarFeedCard({
  profile,
  appUrl,
}: {
  profile: Profile;
  appUrl: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState(profile.calendar_feed_token);

  const httpUrl = `${appUrl}/api/calendar/${token}`;
  // webcal:// makes phones offer to subscribe rather than download a file.
  const webcalUrl = httpUrl.replace(/^https?:\/\//, "webcal://");

  async function copy() {
    try {
      await navigator.clipboard.writeText(webcalUrl);
      toast.success(t("admins.linkCopied"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  function regenerate() {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      startTransition(async () => {
        const result = await regenerateCalendarToken();
        if (result.ok) {
          setToken(result.data.token);
          router.refresh();
        }
        resolve(result);
      });
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <CalendarDays
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t("admins.calendarFeed")}</p>
            <p className="text-sm text-muted-foreground">
              {t("admins.calendarFeedHelp")}
            </p>
          </div>
        </div>

        {/* min-w-0 on the input's wrapper: a flex item defaults to its
            content's minimum width, and this URL is one long unbroken
            string, so without it the input refuses to shrink and pushes the
            buttons past the edge of the card. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            readOnly
            value={webcalUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 font-mono text-xs"
            aria-label={t("admins.calendarFeed")}
          />
          <div className="flex shrink-0 gap-2">
            <Button onClick={copy} disabled={isPending}>
              <Copy className="size-4" aria-hidden />
              {t("admins.copyLink")}
            </Button>
            <ConfirmDelete
              title={t("admins.regenerateConfirm")}
              description={t("admins.regenerateWarning")}
              confirmLabel={t("admins.regenerate")}
              onConfirm={regenerate}
              trigger={
                <Button variant="outline" disabled={isPending}>
                  <RefreshCw className="size-4" aria-hidden />
                  <span className="sr-only sm:not-sr-only">
                    {t("admins.regenerate")}
                  </span>
                </Button>
              }
            />
          </div>
        </div>

        {/* Anyone holding this URL can read the feed — there is no login on
            a calendar subscription. Worth saying out loud. */}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("admins.keepPrivate")}
        </p>
      </CardContent>
    </Card>
  );
}
