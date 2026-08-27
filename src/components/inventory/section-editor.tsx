"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import {
  updateSection,
  uploadPhoto,
  deletePhoto,
  getPhotoUrls,
} from "@/lib/actions/inventory";
import { RatingPicker } from "./rating-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Camera, ImagePlus, Trash2, TriangleAlert } from "lucide-react";
import type { ChecklistPhoto, ChecklistSection, ConditionRating } from "@/lib/types";

/**
 * Photos are compressed in the browser before upload.
 *
 * A condition report needs enough detail to show a scuff, not print
 * resolution. Raw phone photos run 3–5MB each and a full report can carry
 * hundreds — that would exhaust the storage tier within a couple of
 * tenancies. ~1600px on the long edge keeps damage clearly visible.
 */
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

export function SectionEditor({
  section,
  photos,
}: {
  section: ChecklistSection;
  photos: ChecklistPhoto[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Local copies so the pills respond instantly rather than waiting on a
  // round trip — the save happens in the background.
  const [condition, setCondition] = useState(section.condition_rating);
  const [cleanliness, setCleanliness] = useState(section.cleanliness_rating);
  const [description, setDescription] = useState(section.description ?? "");
  const [flagged, setFlagged] = useState(section.flagged_for_maintenance);

  // Photos live in a private bucket, so each needs a signed URL to display.
  // Keyed on the paths themselves so this only re-runs when the set of
  // photos actually changes, not on every render of the parent.
  const photoPaths = photos.map((p) => p.storage_path).join(",");
  useEffect(() => {
    if (!photoPaths) return;
    let cancelled = false;
    getPhotoUrls(photoPaths.split(",")).then((res) => {
      if (!cancelled && res.ok) setUrls(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [photoPaths]);

  function save(values: Parameters<typeof updateSection>[1]) {
    startTransition(async () => {
      const result = await updateSection(section.id, values);
      if (!result.ok) toast.error(result.error);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading(list.length);

    for (const file of list) {
      try {
        const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
        const formData = new FormData();
        formData.set("section_id", section.id);
        formData.set("file", compressed, file.name);
        // Prefer the file's own timestamp over upload time.
        formData.set("taken_at", new Date(file.lastModified).toISOString());

        const result = await uploadPhoto(formData);
        if (!result.ok) toast.error(result.error);
      } catch {
        toast.error(t("common.error"));
      } finally {
        setUploading((n) => n - 1);
      }
    }

    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium">{section.section_name}</p>
          {flagged && (
            <TriangleAlert
              className="size-4 shrink-0 text-amber-600"
              aria-label={t("inventory.flagMaintenance")}
            />
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
          <RatingPicker
            label={t("inventory.condition")}
            value={condition}
            disabled={isPending}
            onChange={(v: ConditionRating) => {
              setCondition(v);
              save({ condition_rating: v });
            }}
          />
          <RatingPicker
            label={t("inventory.cleanliness")}
            value={cleanliness}
            disabled={isPending}
            onChange={(v: ConditionRating) => {
              setCleanliness(v);
              save({ cleanliness_rating: v });
            }}
          />
        </div>

        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== (section.description ?? ""))
              save({ description: description || null });
          }}
          placeholder={t("inventory.descriptionPlaceholder")}
          rows={2}
          aria-label={t("inventory.description")}
        />

        <div className="flex items-center gap-2">
          <Checkbox
            id={`flag-${section.id}`}
            checked={flagged}
            onCheckedChange={(v) => {
              const next = v === true;
              setFlagged(next);
              save({ flagged_for_maintenance: next });
            }}
          />
          <Label htmlFor={`flag-${section.id}`} className="font-normal">
            {t("inventory.flagMaintenance")}
          </Label>
        </div>

        {/* Photos */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("inventory.photoCount", { count: photos.length })}
            </span>
            <div className="ml-auto flex gap-2">
              {/* capture="environment" opens the rear camera directly on a
                  phone, which is how these are taken in practice. */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraRef.current?.click()}
                disabled={uploading > 0}
              >
                <Camera className="size-4" aria-hidden />
                {t("inventory.takePhoto")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading > 0}
              >
                <ImagePlus className="size-4" aria-hidden />
                {t("inventory.addPhotos")}
              </Button>
            </div>
          </div>

          {uploading > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("documents.uploading")} ({uploading})
            </p>
          )}

          {photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {photos.map((photo) => (
                <li key={photo.id} className="group relative">
                  {urls[photo.storage_path] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URLs expire, so the optimiser can't cache them
                    <img
                      src={urls[photo.storage_path]}
                      alt={photo.caption ?? section.section_name}
                      className="aspect-square w-full rounded-md object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="aspect-square w-full animate-pulse rounded-md bg-muted" />
                  )}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate rounded-b-md bg-black/60 px-1 py-0.5 text-[10px] text-white">
                    {format.dateTime(new Date(photo.taken_at), {
                      dateStyle: "short",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        const res = await deletePhoto(photo.id);
                        if (!res.ok) toast.error(res.error);
                        else router.refresh();
                      })
                    }
                    className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
