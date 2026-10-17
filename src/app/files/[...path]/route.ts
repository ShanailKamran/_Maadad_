import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getPrivate } from "@/lib/storage";
import { readIdentityDocument } from "@/lib/admin";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Access-controlled streaming endpoint for private files.
 * URL structures:
 *   /files/job-photo/:id
 *   /files/worker-photo/:id
 *   /files/identity/:id  (admin only, strictly audit-logged)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { path?: string[] } },
) {
  const parts = params.path ?? [];
  if (parts.length !== 2) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const [kind, id] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("Invalid ID", { status: 400 });
  }

  const user = await getUser();

  try {
    if (kind === "job-photo") {
      // Must be authenticated to view job photos, and job must not be hidden
      if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const photo = await one<{ storage_key: string; mime_type: string; status: string; customer_id: string }>(
        `SELECT p.storage_key, p.mime_type, j.status, j.customer_id
         FROM job_photos p
         JOIN jobs j ON j.id = p.job_id
         WHERE p.id = $1 AND j.hidden_at IS NULL`,
        [id],
      );

      if (!photo) {
        return new NextResponse("Photo not found", { status: 404 });
      }

      const data = await getPrivate(photo.storage_key);
      return new NextResponse(data as unknown as BodyInit, {
        headers: {
          "Content-Type": photo.mime_type,
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (kind === "worker-photo") {
      // Publicly viewable for active users
      const photo = await one<{ storage_key: string; mime_type: string }>(
        `SELECT wp.storage_key, wp.mime_type
         FROM worker_photos wp
         JOIN users u ON u.id = wp.user_id
         WHERE wp.id = $1 AND u.account_status = 'active' AND u.deleted_at IS NULL`,
        [id],
      );

      if (!photo) {
        return new NextResponse("Photo not found", { status: 404 });
      }

      const data = await getPrivate(photo.storage_key);
      return new NextResponse(data as unknown as BodyInit, {
        headers: {
          "Content-Type": photo.mime_type,
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (kind === "identity") {
      // Strictly admin-only; readIdentityDocument performs verification and audit logging
      if (!user || !user.is_admin || user.account_status !== "active") {
        return new NextResponse("Not Found", { status: 404 });
      }

      const doc = await readIdentityDocument(user, id);
      return new NextResponse(doc.data as unknown as BodyInit, {
        headers: {
          "Content-Type": doc.mime,
          "Cache-Control": "no-store, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new NextResponse("Not Found", { status: 404 });
  } catch (err) {
    log.error("file_serve_error", { kind, id, err });
    return new NextResponse("Not Found", { status: 404 });
  }
}
