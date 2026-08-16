/**
 * GET /api/platforms — catálogo de plataformas y nivel de automatización.
 */

import { NextResponse } from "next/server";
import { PLATFORM_CATALOG, countPlatforms } from "@/lib/platforms/catalog";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ platforms: PLATFORM_CATALOG, counts: countPlatforms() });
}
