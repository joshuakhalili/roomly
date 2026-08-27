"use server";

import { revalidatePath } from "next/cache";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  type ActionResult,
} from "./helpers";
import { TENANT_DOCUMENT_TYPES, type DocumentType } from "@/lib/types";

/** Which private bucket each document type lives in. */
const BUCKETS: Record<DocumentType, string> = {
  passport: "passports",
  right_to_rent: "right-to-rent",
  tenancy_agreement: "tenancy-agreements",
  deposit_certificate: "deposit-certs",
  handbook: "handbooks",
  other: "handbooks",
};

const MAX_BYTES = 15 * 1024 * 1024; // 15MB — generous for a scan or a PDF

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/pdf",
];

/** How long a document view link stays valid. */
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

function isDocumentType(v: string | null): v is DocumentType {
  return v !== null && v in BUCKETS;
}

/** Strips anything that could escape the intended storage folder. */
function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]/g, "_").slice(-120);
}

export async function uploadDocument(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const tenancyId = optionalText(formData.get("tenancy_id"));
  const tenantId = optionalText(formData.get("tenant_id"));
  const docTypeRaw = optionalText(formData.get("doc_type"));
  const file = formData.get("file");

  if (!tenancyId && !tenantId)
    return { ok: false, error: "Missing tenant or tenancy." };
  if (!isDocumentType(docTypeRaw))
    return { ok: false, error: "Choose a document type." };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose a file to upload." };
  if (file.size > MAX_BYTES)
    return { ok: false, error: "That file is larger than 15MB." };
  if (file.type && !ALLOWED_MIME.includes(file.type))
    return { ok: false, error: "Only images and PDFs can be uploaded." };

  const bucket = BUCKETS[docTypeRaw];

  // Identity documents describe the person and are reused if they rent
  // again; agreements describe one letting. Storing them against the right
  // owner is what stops a passport being re-uploaded every tenancy.
  const belongsToTenant = TENANT_DOCUMENT_TYPES.includes(docTypeRaw) && tenantId;
  const owner = belongsToTenant
    ? { tenant_id: tenantId, tenancy_id: null }
    : { tenant_id: tenantId, tenancy_id: tenancyId };

  // Namespaced by owner so a tenancy's or tenant's files can be found — and
  // deleted — as a unit when retention runs.
  const prefix = belongsToTenant ? `tenant/${tenantId}` : `tenancy/${tenancyId}`;
  const path = `${prefix}/${Date.now()}-${safeFileName(file.name)}`;

  const { error: uploadError } = await auth.supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data, error } = await auth.supabase
    .from("documents")
    .insert({
      ...owner,
      doc_type: docTypeRaw,
      file_name: file.name,
      storage_path: `${bucket}/${path}`,
      file_size: file.size,
      notes: optionalText(formData.get("notes")),
    })
    .select("id")
    .single();

  if (error) {
    // Don't leave an orphaned file in storage that no record points at.
    await auth.supabase.storage.from(bucket).remove([path]);
    return { ok: false, error: friendlyError(error) };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

/**
 * Mints a short-lived link to view one document.
 *
 * Buckets are private, so there is no permanent URL to leak: every view is
 * an authenticated request that produces a link expiring in minutes.
 */
export async function getDocumentUrl(
  documentId: string,
): Promise<ActionResult<{ url: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: doc, error } = await auth.supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (error || !doc) return { ok: false, error: "Document not found." };

  const [bucket, ...rest] = doc.storage_path.split("/");
  const { data: signed, error: signError } = await auth.supabase.storage
    .from(bucket)
    .createSignedUrl(rest.join("/"), SIGNED_URL_TTL_SECONDS);

  if (signError || !signed)
    return { ok: false, error: signError?.message ?? "Could not open file." };

  return { ok: true, data: { url: signed.signedUrl } };
}

export async function deleteDocument(
  documentId: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: doc } = await auth.supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  const { error } = await auth.supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (error) return { ok: false, error: friendlyError(error) };

  // Remove the file too — deleting only the row would leave the scan sitting
  // in storage, which defeats the point of deleting it.
  if (doc?.storage_path) {
    const [bucket, ...rest] = doc.storage_path.split("/");
    await auth.supabase.storage.from(bucket).remove([rest.join("/")]);
  }

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
