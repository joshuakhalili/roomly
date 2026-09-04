"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { getPhotoUrls, recordPdfExport } from "@/lib/actions/inventory";
import { createClient } from "@/lib/supabase/client";
import { PDF_BUCKET } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileDown } from "lucide-react";
import type { PdfReportData, PdfArea } from "./report-pdf";
import type {
  ChecklistArea,
  ChecklistDeclaration,
  ChecklistDetector,
  ChecklistKey,
  ChecklistMeter,
  ChecklistPhoto,
  ChecklistSection,
} from "@/lib/types";

/**
 * Hands a generated file to the browser.
 *
 * Two things here are not optional, and both were wrong before. The anchor
 * has to be in the document — Firefox ignores a click on one that is not —
 * and the object URL must outlive the click, because revoking it on the very
 * next line can pull the blob away before the browser has finished reading
 * it, which cancels the download it just started.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\s+/g, "-");
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // A minute is far longer than any download needs to start, and costs one
  // unreferenced blob until then.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function ExportPdfButton({
  checklistId,
  meta,
  areas,
  sections,
  photos,
  meters,
  keys,
  detectors,
  declarations,
}: {
  checklistId: string;
  meta: {
    propertyName: string;
    roomName: string;
    address: string | null;
    type: string;
    occupants: string[];
  };
  areas: ChecklistArea[];
  sections: ChecklistSection[];
  photos: ChecklistPhoto[];
  meters: ChecklistMeter[];
  keys: ChecklistKey[];
  detectors: ChecklistDetector[];
  declarations: ChecklistDeclaration[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      // Photos live in private buckets. Sign them all in one batch, then let
      // react-pdf fetch each while it lays the document out.
      const allPaths = photos.map((p) => p.storage_path);
      const signed = allPaths.length ? await getPhotoUrls(allPaths) : null;
      const urlMap = signed?.ok ? signed.data : {};

      const shortDate = (iso: string) =>
        format.dateTime(new Date(iso), { dateStyle: "short" });

      const pdfAreas: PdfArea[] = areas.map((area) => ({
        name: area.name,
        sections: sections
          .filter((s) => s.checklist_area_id === area.id)
          .map((s) => ({
            name: s.section_name,
            condition: s.condition_rating,
            cleanliness: s.cleanliness_rating,
            description: s.description,
            flagged: s.flagged_for_maintenance,
            photos: photos
              .filter(
                (p) =>
                  p.checklist_section_id === s.id && urlMap[p.storage_path],
              )
              .map((p) => ({
                url: urlMap[p.storage_path],
                takenAt: shortDate(p.taken_at),
              })),
          })),
      }));

      const data: PdfReportData = {
        ...meta,
        dateLabel: format.dateTime(new Date(), { dateStyle: "long" }),
        areas: pdfAreas,
        meters: meters.map((m) => ({
          type: t(
            m.meter_type === "electricity"
              ? "inventory.meterElectricity"
              : m.meter_type === "gas"
                ? "inventory.meterGas"
                : "inventory.meterWater",
          ),
          reading: m.reading ?? "",
          serial: m.serial_number,
        })),
        keys: keys.map((k) => ({
          description: k.description,
          quantity: k.quantity,
          comments: k.comments,
        })),
        detectors: detectors.map((d) => ({
          type: t(
            d.detector_type === "smoke"
              ? "inventory.smokeAlarm"
              : "inventory.coDetector",
          ),
          location: d.location,
          tested: d.tested,
        })),
        declarations: declarations.map((d) => ({
          role:
            d.role === "assessor"
              ? t("inventory.assessorDeclaration")
              : t("inventory.tenantDeclaration"),
          name: d.typed_name,
          signedAt: format.dateTime(new Date(d.signed_at), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })),
        // The PDF is English-only by design, so its labels are passed in
        // rather than read from the active locale.
        labels: {
          reportTitle: "Inventory / Schedule of Condition",
          summary: "Report summary",
          area: "Area",
          condition: "Condition",
          cleanliness: "Cleanliness",
          defects: "Defects",
          photos: "Photos",
          meters: "Meters",
          keys: "Keys",
          detectors: "Detectors",
          declarations: "Declarations",
          noDefects: "No defects recorded.",
          maintenance: "Needs maintenance",
          yes: "Yes",
          no: "No",
        },
      };

      // Imported here rather than at module scope: the renderer is a large
      // dependency and no one should download it just to view a checklist.
      const [{ pdf }, { ReportPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./report-pdf"),
      ]);

      const blob = await pdf(<ReportPdf data={data} />).toBlob();

      /* The download comes first, before anything that can fail.
         Archiving used to run ahead of it, so a storage problem meant the
         admin lost a report that had already been built — the expensive part
         done, and nothing to show for it. */
      downloadBlob(blob, `${meta.roomName} - ${meta.type}.pdf`);

      /* Uploaded straight from the browser rather than through a Server
         Action. An action is a POST to the app, and Next caps that body at
         1MB by default while Vercel caps it at 4.5MB regardless — and a full
         report with a few hundred photos is several megabytes. Storage has no
         such ceiling, and the bucket's policy already requires an
         authenticated admin, so this is the same permission either way. */
      const supabase = createClient();
      const path = `${checklistId}/${Date.now()}-report.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(path, blob, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        // They have their PDF; only the archived copy failed. Say which.
        console.error("Report upload failed", uploadError);
        toast.error(t("inventory.exportNotArchived"));
        return;
      }

      const stored = await recordPdfExport(checklistId, path, blob.size);
      if (!stored.ok) {
        console.error("Report record failed", stored.error);
        toast.error(stored.error);
        return;
      }

      toast.success(t("common.saved"));
      router.refresh();
    } catch (error) {
      /* Logged as well as shown. This was a bare catch with a generic
         message, which meant a failure here left nothing behind to work out
         why — the one thing you need when a report will not generate. */
      console.error("PDF export failed", error);
      toast.error(
        error instanceof Error ? error.message : t("common.error"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={busy} variant="outline">
          <FileDown className="size-4" aria-hidden />
          {busy ? t("inventory.generating") : t("inventory.exportPdf")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("inventory.exportConfirmTitle")}</AlertDialogTitle>
          {/* Stated before it happens, not discovered afterwards. Once the
              originals go, what survives is whatever the PDF flattened — no
              re-cropping, no zooming back to full resolution. That is the
              intended trade at ~30 rooms of photos, but it is a real one. */}
          <AlertDialogDescription>
            {t("inventory.exportConfirmBody", { count: photos.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              generate();
            }}
            disabled={busy}
          >
            {t("inventory.exportPdf")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
