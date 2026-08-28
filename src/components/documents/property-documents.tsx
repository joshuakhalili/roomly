"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DocumentLibrary } from "./document-library";
import { LibraryUploadDialog } from "./library-upload-dialog";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import type { DocumentRecord, Property } from "@/lib/types";

/**
 * A property's slice of the document library, shown in place.
 *
 * Reuses the library component rather than duplicating it, so expiry
 * warnings and version history behave identically wherever you look.
 */
export function PropertyDocuments({
  property,
  documents,
}: {
  property: Property;
  documents: DocumentRecord[];
}) {
  const t = useTranslations();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("documents.libraryTitle")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("documents.librarySubtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/documents">
              {t("dashboard.viewAll")}
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <LibraryUploadDialog
            properties={[property]}
            defaultPropertyId={property.id}
            trigger={
              <Button size="sm">{t("documents.addDocument")}</Button>
            }
          />
        </div>
      </div>

      <DocumentLibrary documents={documents} properties={[property]} />
    </section>
  );
}
