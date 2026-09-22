import { currentActor } from "@/lib/auth";
import {
  requireActor,
  ownMembership,
  isManager,
  DomainError,
} from "@/lib/permissions";
import { readState } from "@/lib/store";
import { environment } from "@/lib/env";
import { readDemoFile } from "@/lib/demo/store";
import { failure } from "@/lib/http";
import { supabase } from "@/lib/supabase/server";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = requireActor(await currentActor());
    const s = await readState();
    const { id } = await params;
    const attachment = s.maintenance_attachments.find((f) => f.id === id);
    const r = s.maintenance_requests.find(
      (r) => r.id === attachment?.maintenance_request_id,
    );
    if (!r || !attachment)
      throw new DomainError("NOT_FOUND", "Attachment unavailable.");
    if (!isManager(s, a, r.room_id)) ownMembership(s, a, r.membership_id);
    if (environment().demo) {
      const bytes = readDemoFile(attachment.storage_path);
      if (!bytes) throw new DomainError("NOT_FOUND", "Attachment unavailable.");
      return new Response(Buffer.from(bytes), {
        headers: {
          "Content-Type": attachment.mime_type,
          "Content-Disposition": `attachment; filename="${attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const { data, error } = await (
      await supabase()
    ).storage
      .from("maintenance")
      .createSignedUrl(attachment.storage_path, 60, { download: true });
    if (error) throw new DomainError("NOT_FOUND", "Attachment unavailable.");
    return Response.redirect(data.signedUrl);
  } catch (e) {
    return failure(e);
  }
}
