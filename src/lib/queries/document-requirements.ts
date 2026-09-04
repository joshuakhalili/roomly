import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DocumentRequirement,
  DocumentType,
  LettingType,
} from "@/lib/types";

/**
 * Which documents each kind of letting has to have.
 *
 * Small, rarely-changing table read on several pages, so it is fetched once
 * per request and grouped here rather than every caller writing the same
 * query and the same `filter` afterwards. The dashboard's compliance count
 * and the panel that chases the documents have to agree — the moment they are
 * two separate implementations, they will not.
 */
export async function getDocumentRequirements(
  supabase: SupabaseClient,
): Promise<DocumentRequirement[]> {
  const { data } = await supabase
    .from("document_requirements")
    .select("*")
    .order("sort_order");

  return (data ?? []) as DocumentRequirement[];
}

/**
 * The document types a letting of this type must have.
 *
 * `scope` narrows to one side of the tenant/tenancy split, which is what the
 * documents panel needs — it is only responsible for chasing the half it
 * shows. Omit it to get everything, which is what a compliance count wants.
 */
export function requiredTypesFor(
  requirements: DocumentRequirement[],
  lettingType: LettingType,
  scope?: "tenant" | "tenancy",
): DocumentType[] {
  return requirements
    .filter((r) => r.letting_type === lettingType)
    .filter((r) => !scope || r.owner_scope === scope)
    .map((r) => r.doc_type);
}

/**
 * The subset that follows the person rather than the letting.
 *
 * The compliance count needs this to know which requirements can be satisfied
 * by a document filed against a tenant instead of against their tenancy.
 */
export function tenantScopedTypes(
  requirements: DocumentRequirement[],
): Set<DocumentType> {
  return new Set(
    requirements.filter((r) => r.owner_scope === "tenant").map((r) => r.doc_type),
  );
}
