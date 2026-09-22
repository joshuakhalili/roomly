import { NextResponse } from "next/server";
import { currentActor } from "@/lib/auth";
import { requireActor, ownMembership, DomainError } from "@/lib/permissions";
import { transaction } from "@/lib/store";
import { environment } from "@/lib/env";
import { storeDemoFile } from "@/lib/demo/store";
import { base } from "@/lib/domain";
import { checkOrigin, failure } from "@/lib/http";
import { supabase } from "@/lib/supabase/server";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const a = requireActor(await currentActor());
    const f = await req.formData();
    const file = f.get("file");
    const requestId = String(f.get("requestId"));
    if (
      !(file instanceof File) ||
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "application/pdf"].includes(file.type)
    )
      throw new DomainError(
        "INVALID_ATTACHMENT",
        "Choose a JPG, PNG or PDF up to 5 MB.",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid =
      file.type === "image/png"
        ? bytes[0] === 137 && bytes[1] === 80
        : file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216
          : bytes[0] === 37 &&
            bytes[1] === 80 &&
            bytes[2] === 68 &&
            bytes[3] === 70;
    if (!valid)
      throw new DomainError(
        "INVALID_ATTACHMENT",
        "The file contents do not match its type.",
      );
    const data = await transaction(a, async (s) => {
      const r = s.maintenance_requests.find((r) => r.id === requestId);
      if (!r) throw new DomainError("NOT_FOUND", "Repair unavailable.");
      ownMembership(s, a, r.membership_id);
      if (r.status !== "draft")
        throw new DomainError(
          "ALREADY_SUBMITTED",
          "Attachments must be added before confirmation.",
        );
      const b = base();
      const storagePath = `${a.id}/${r.id}/${b.id}`;
      if (environment().demo) storeDemoFile(storagePath, bytes);
      else {
        const { error } = await (
          await supabase()
        ).storage
          .from("maintenance")
          .upload(storagePath, bytes, {
            contentType: file.type,
            upsert: false,
          });
        if (error)
          throw new DomainError(
            "UPLOAD_FAILED",
            "The attachment could not be saved. Retry before submitting.",
          );
      }
      const row = {
        ...b,
        maintenance_request_id: r.id,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        name: file.name.slice(0, 160),
      };
      s.maintenance_attachments.push(row);
      return { id: row.id };
    });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return failure(e);
  }
}
