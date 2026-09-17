import "server-only";

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;

export const DOCUMENT_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  "application/pdf",
] as const;

export type VerifiedMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

const EXTENSION: Record<VerifiedMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function detectMime(bytes: Uint8Array): VerifiedMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP")
    return "image/webp";

  // HEIC/HEIF files are ISO base media containers. The major brand is at
  // bytes 8-11 following the initial `ftyp` box marker.
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12).toLowerCase();
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1"].includes(brand)) return "image/heif";
  }

  return null;
}

/**
 * Creates a short, path-safe display/storage name with an extension that
 * matches the verified bytes rather than the browser-supplied filename.
 */
export function safeUploadName(name: string, mime: VerifiedMimeType): string {
  const normalised = name.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "");
  const leaf = normalised.split(/[\\/]/).pop() ?? "upload";
  const base = leaf.replace(/\.[^.]*$/, "").replace(/[^\w.-]/g, "_").slice(0, 100);
  return `${base || "upload"}.${EXTENSION[mime]}`;
}

export type UploadInspection =
  | { ok: true; contentType: VerifiedMimeType; safeName: string }
  | { ok: false; error: string };

/**
 * Browser MIME types and filename extensions are attacker-controlled. Read
 * the file signature server-side before an object reaches private storage.
 */
export async function inspectUpload(
  file: File,
  allowed: readonly VerifiedMimeType[],
): Promise<UploadInspection> {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detected = detectMime(bytes);

  if (!detected || !allowed.includes(detected))
    return { ok: false, error: "The file contents do not match an allowed format." };

  if (file.type && file.type !== detected) {
    // Some browsers label HEIF-family files interchangeably. Treat those two
    // types as equivalent, but reject every other claimed/actual mismatch.
    const heifFamily = new Set(["image/heic", "image/heif"]);
    if (!(heifFamily.has(file.type) && heifFamily.has(detected)))
      return { ok: false, error: "The file type does not match its contents." };
  }

  return {
    ok: true,
    contentType: detected,
    safeName: safeUploadName(file.name, detected),
  };
}
