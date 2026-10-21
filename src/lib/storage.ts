import { mkdir, writeFile, readFile, rm } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { storage } from "./config";
import { AppError } from "./state";
import {
  isSupabaseConfigured,
  uploadToSupabaseStorage,
  getFromSupabaseStorage,
  deleteFromSupabaseStorage,
} from "./supabase";

/**
 * Private file storage. Files are written OUTSIDE the Next.js public directory and are only
 * ever served through authorised route handlers (src/app/files/*), never by direct URL.
 *
 * Supported drivers:
 * 1. "local" (default): Private directory on server disk with traversal protection and 0o600 permissions.
 * 2. "supabase": Private cloud object storage using Supabase Storage buckets ('job-photos', 'worker-photos', 'identity').
 */
const root = () => path.resolve(storage.localDir);

const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Magic-byte sniffing: never trust the browser-supplied Content-Type. */
export function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return null;
}

export type Bucket = "job-photos" | "worker-photos" | "identity";

export async function putPrivate(
  bucket: Bucket,
  data: Buffer,
  maxBytes: number,
): Promise<{ key: string; mime: string }> {
  if (data.length === 0) throw new AppError("Empty file.");
  if (data.length > maxBytes) throw new AppError(`Photo is too large (max ${(maxBytes / 1e6).toFixed(1)} MB).`);
  const mime = sniffImage(data);
  if (!mime) throw new AppError("Only JPEG, PNG or WebP photos are allowed.");
  // Photos other users can see must not carry EXIF (it can include GPS coordinates).
  // The browser picker re-encodes via canvas, which strips EXIF; direct uploads with EXIF are refused.
  if (bucket !== "identity" && mime === "image/jpeg" && data.subarray(0, 65536).includes(Buffer.from("Exif\0\0", "binary")))
    throw new AppError("This photo contains location metadata. Please choose it again using the photo button so it can be cleaned.");

  const filename = `${randomUUID()}.${MIME_EXT[mime]}`;
  const key = `${bucket}/${filename}`;

  // If Supabase Storage is configured and chosen as the storage driver, upload to cloud bucket
  if (storage.driver === "supabase" && isSupabaseConfigured()) {
    try {
      await uploadToSupabaseStorage(bucket, filename, data, mime);
      return { key, mime };
    } catch (err) {
      console.warn("[Storage] Supabase storage upload failed, saving to local private fallback:", err);
    }
  }

  // Default: local private directory storage
  const full = path.join(root(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { mode: 0o600 });
  return { key, mime };
}

function safePath(key: string): string {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new AppError("Invalid file.", "forbidden"); // traversal guard
  return full;
}

export async function getPrivate(key: string): Promise<Buffer> {
  // If Supabase driver is configured, attempt cloud download first
  if (storage.driver === "supabase" && isSupabaseConfigured() && key.includes("/")) {
    const slashIdx = key.indexOf("/");
    const bucket = key.substring(0, slashIdx);
    const filename = key.substring(slashIdx + 1);
    try {
      return await getFromSupabaseStorage(bucket, filename);
    } catch (err) {
      console.warn("[Storage] Could not fetch from Supabase, attempting local fallback:", err);
    }
  }

  return readFile(safePath(key));
}

export async function deletePrivate(key: string): Promise<void> {
  if (storage.driver === "supabase" && isSupabaseConfigured() && key.includes("/")) {
    const slashIdx = key.indexOf("/");
    const bucket = key.substring(0, slashIdx);
    const filename = key.substring(slashIdx + 1);
    try {
      await deleteFromSupabaseStorage(bucket, filename);
    } catch {
      // Non-blocking
    }
  }

  await rm(safePath(key), { force: true }).catch(() => undefined);
}
