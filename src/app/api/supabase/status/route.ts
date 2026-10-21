import { NextResponse } from "next/server";
import { testSupabaseConnection } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await testSupabaseConnection();
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ...health,
    });
  } catch (err) {
    return NextResponse.json(
      {
        configured: false,
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
