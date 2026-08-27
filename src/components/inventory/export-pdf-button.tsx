"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { getPhotoUrls, recordPdfExport } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
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

      // Save a copy server-side — this is what later makes it safe to purge
      // the original photos, and it keeps the report if the tenancy ends.
      const fd = new FormData();
      fd.set("file", blob, `${meta.roomName}-${meta.type}.pdf`);
      const stored = await recordPdfExport(checklistId, fd);
      if (!stored.ok) toast.error(stored.error);

      // Hand the file to the admin as well.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${meta.roomName} - ${meta.type}.pdf`.replace(/\s+/g, "-");
      a.click();
      URL.revokeObjectURL(url);

      toast.success(t("common.saved"));
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={generate} disabled={busy} variant="outline">
      <FileDown className="size-4" aria-hidden />
      {busy ? t("inventory.generating") : t("inventory.exportPdf")}
    </Button>
  );
}
