import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <SearchX className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("notFoundDetail")}</p>
      </div>
      <Button asChild>
        <Link href="/">{t("home")}</Link>
      </Button>
    </div>
  );
}
