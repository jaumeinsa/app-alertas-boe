import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { scanProfile } from "@/lib/scan";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const profiles = await prisma.monitoredProfile.findMany({
    where: { userId: user.id, active: true },
    select: { id: true },
  });

  let found = 0;
  for (const p of profiles) {
    found += await scanProfile(p.id);
  }
  return NextResponse.json({ ok: true, found });
}
