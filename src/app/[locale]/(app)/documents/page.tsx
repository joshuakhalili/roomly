import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DocumentLibrary } from "@/components/documents/document-library";
import { LibraryUploadDialog } from "@/components/documents/library-upload-dialog";
import type { DocumentRecord, Property } from "@/lib/types";

/**
 * The business's filing cabinet.
 *
 * Deliberately holds nothing tenant-facing: identity documents, contracts
 * and deposit paperwork stay with the person and their letting, where
 * they're needed. This is licences, safety certificates and invoices.
 */
export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: documents }, { data: properties }] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .or("property_id.not.is.null,is_company_wide.is.true")
      .order("uploaded_at", { ascending: false }),
    supabase.from("properties").select("*").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("documents.libraryTitle")}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("documents.librarySubtitle")}
          </p>
        </div>
        <LibraryUploadDialog properties={(properties ?? []) as Property[]} />
      </header>

      <DocumentLibrary
        documents={(documents ?? []) as DocumentRecord[]}
        properties={(properties ?? []) as Property[]}
      />
    </div>
  );
}
