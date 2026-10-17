import { NextRequest, NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance";
import { cronSecret } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronSecret) {
    return new NextResponse("Cron endpoint is disabled (CRON_SECRET not configured).", {
      status: 403,
    });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") || req.nextUrl.searchParams.get("secret");

  if (!token || token !== cronSecret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await runMaintenance();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Maintenance failed" }, { status: 500 });
  }
}
