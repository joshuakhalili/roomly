"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

/**
 * Icon-only in the header, where space is tight and the icon is universal.
 * Labelled on the Settings page, where an unlabelled icon among form fields
 * reads as decoration rather than the one control that ends your session.
 */
export function SignOutButton({ showLabel = false }: { showLabel?: boolean }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await createClient().auth.signOut();
      // refresh() so the server re-reads the (now empty) session and the
      // proxy redirects to login.
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <Button
      variant={showLabel ? "outline" : "ghost"}
      size="sm"
      onClick={signOut}
      disabled={isPending}
      aria-label={t("signOut")}
    >
      <LogOut className="size-4" aria-hidden />
      {showLabel ? t("signOut") : <span className="sr-only">{t("signOut")}</span>}
    </Button>
  );
}
