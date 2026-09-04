"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requireAdmin,
  friendlyError,
  optionalText,
  type ActionResult,
} from "./helpers";
import { splitStoragePath } from "@/lib/retention";

const BANNER_BUCKET = "property-banners";

/** Matches the ceiling on every other bucket. */
const MAX_BANNER_BYTES = 15 * 1024 * 1024;

const ALLOWED_BANNER_MIME = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

/** Strips anything that could escape the intended storage folder. */
function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]/g, "_").slice(-120);
}

/**
 * Uploads a new banner and returns its stored path.
 *
 * Returns null when no file was chosen, which is the normal case on an edit
 * where someone changed the address and nothing else — distinct from a
 * failure, which comes back as a string.
 */
async function uploadBanner(
  supabase: SupabaseClient,
  propertyId: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  if (file.size > MAX_BANNER_BYTES)
    return { error: "That image is larger than 15MB." };
  if (file.type && !ALLOWED_BANNER_MIME.includes(file.type))
    return { error: "Only images can be used as a banner." };

  const path = `${propertyId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (error) return { error: error.message };
  return { path: `${BANNER_BUCKET}/${path}` };
}

/** Removes a stored object, given the "<bucket>/<path>" form we keep. */
async function removeStored(supabase: SupabaseClient, stored: string | null) {
  const ref = splitStoragePath(stored);
  if (!ref) return;
  await supabase.storage.from(ref.bucket).remove([ref.path]);
}

/** Reads the banner off a form, if one was actually chosen. */
function bannerFile(formData: FormData): File | null {
  const file = formData.get("banner");
  return file instanceof File && file.size > 0 ? file : null;
}

export async function createProperty(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const name = optionalText(formData.get("name"));
  if (!name) return { ok: false, error: "A property name is required." };

  const { data, error } = await auth.supabase
    .from("properties")
    .insert({
      name,
      address: optionalText(formData.get("address")),
      notes: optionalText(formData.get("notes")),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: friendlyError(error) };

  /* The banner goes up after the row exists, because the storage path is
     namespaced by property id — which is not known until the insert returns.
     A failure here leaves a property without a picture rather than no
     property at all, which is the better of the two. */
  const file = bannerFile(formData);
  if (file) {
    const result = await uploadBanner(auth.supabase, data.id, file);
    if ("error" in result) return { ok: false, error: result.error };

    const { error: bannerError } = await auth.supabase
      .from("properties")
      .update({ banner_path: result.path })
      .eq("id", data.id);

    if (bannerError) {
      await removeStored(auth.supabase, result.path);
      return { ok: false, error: friendlyError(bannerError) };
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function updateProperty(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const name = optionalText(formData.get("name"));
  if (!name) return { ok: false, error: "A property name is required." };

  const fields: Record<string, unknown> = {
    name,
    address: optionalText(formData.get("address")),
    notes: optionalText(formData.get("notes")),
  };

  // What is on file now, so the old image can be cleared up once the new one
  // has safely replaced it.
  const { data: existing } = await auth.supabase
    .from("properties")
    .select("banner_path")
    .eq("id", id)
    .single();

  const file = bannerFile(formData);
  let uploadedPath: string | null = null;

  if (file) {
    const result = await uploadBanner(auth.supabase, id, file);
    if ("error" in result) return { ok: false, error: result.error };
    uploadedPath = result.path;
    fields.banner_path = result.path;
  } else if (formData.get("remove_banner") === "on") {
    fields.banner_path = null;
  }

  const { error } = await auth.supabase
    .from("properties")
    .update(fields)
    .eq("id", id);

  if (error) {
    // The row did not change, so the file that was just uploaded belongs to
    // nothing. Take it back out rather than leaving it in the bucket.
    if (uploadedPath) await removeStored(auth.supabase, uploadedPath);
    return { ok: false, error: friendlyError(error) };
  }

  // Only once the row points at the new image is the old one safe to delete.
  const replaced = uploadedPath || fields.banner_path === null;
  if (replaced && existing?.banner_path !== uploadedPath) {
    await removeStored(auth.supabase, existing?.banner_path ?? null);
  }

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Deleting a property cascades to its rooms, tenancies, occupants and
 * documents. The UI warns about this before calling it.
 *
 * The cascade reaches rows and stops there. Postgres has no idea the
 * documents it just deleted had files behind them, so those files would sit
 * in the bucket with nothing pointing at them — and nothing pointing at them
 * means no retention rule can ever find them again. Files first, then the
 * row, the same order the retention job uses and for the same reason.
 */
export async function deleteProperty(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const { data: property } = await auth.supabase
    .from("properties")
    .select("banner_path")
    .eq("id", id)
    .single();

  // Every document filed against this property or any of its rooms. Fetched
  // by path rather than swept by prefix so a file stored under a different
  // convention is still caught.
  const { data: rooms } = await auth.supabase
    .from("rooms")
    .select("id")
    .eq("property_id", id);

  const roomIds = (rooms ?? []).map((r) => r.id as string);
  const { data: docs } = await auth.supabase
    .from("documents")
    .select("storage_path")
    .or(
      roomIds.length
        ? `property_id.eq.${id},room_id.in.(${roomIds.join(",")})`
        : `property_id.eq.${id}`,
    );

  const paths = [
    property?.banner_path ?? null,
    ...(docs ?? []).map((d) => d.storage_path as string | null),
  ];

  // Grouped per bucket: the storage API removes many paths at once, but only
  // within one bucket.
  const byBucket = new Map<string, string[]>();
  for (const stored of paths) {
    const ref = splitStoragePath(stored);
    if (!ref) continue;
    const list = byBucket.get(ref.bucket) ?? [];
    list.push(ref.path);
    byBucket.set(ref.bucket, list);
  }

  for (const [bucket, keys] of byBucket) {
    const { error } = await auth.supabase.storage.from(bucket).remove(keys);
    /* Stop rather than press on. A property whose files could not be removed
       is still there to try again; one deleted anyway has left personal data
       in a bucket that nothing references and nobody will ever look at. */
    if (error)
      return {
        ok: false,
        error: `Could not delete the property's files, so nothing was deleted: ${error.message}`,
      };
  }

  const { error } = await auth.supabase.from("properties").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
