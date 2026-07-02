import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { CONSENT_VERSION } from "@/lib/consent";
import { detectIdType, idSuffix, isValidDniNie, kindForIdType, normalizeId } from "@/lib/ids";
import { nameSearchKey } from "@/lib/matching/normalize";
import { tokenizeName } from "@/lib/matching/normalize";
import { scanProfile } from "@/lib/scan";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const consent = body.consent === true;
  const fullName = String(body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim() || null;
  const idNumberRaw = String(body.idNumber ?? "").trim();
  const provinces = Array.isArray(body.provinces)
    ? (body.provinces as unknown[]).map((p) => String(p)).filter(Boolean)
    : [];

  // Validaciones.
  if (!consent) {
    return NextResponse.json(
      { error: "Debes aceptar el tratamiento de tus datos para poder vigilarte." },
      { status: 400 }
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email no válido." }, { status: 400 });
  }
  if (tokenizeName(fullName).length < 2) {
    return NextResponse.json(
      { error: "Escribe tu nombre y apellidos completos." },
      { status: 400 }
    );
  }
  const idType = detectIdType(idNumberRaw);
  if (!idType) {
    return NextResponse.json(
      { error: "Documento no reconocido. Revisa el DNI, NIE o CIF." },
      { status: 400 }
    );
  }
  if (idType !== "CIF" && !isValidDniNie(idNumberRaw)) {
    return NextResponse.json(
      { error: "La letra del DNI/NIE no es correcta." },
      { status: 400 }
    );
  }

  // Usuario (upsert por email) + consentimiento.
  const user = await prisma.user.upsert({
    where: { email },
    update: { phone, consentAt: new Date(), consentVersion: CONSENT_VERSION },
    create: {
      email,
      phone,
      consentAt: new Date(),
      consentVersion: CONSENT_VERSION,
    },
    include: { subscription: true },
  });

  // Límite de nombres vigilados según el plan (1 si aún no hay suscripción).
  const maxProfiles = user.subscription?.maxProfiles ?? 1;
  const profileCount = await prisma.monitoredProfile.count({ where: { userId: user.id } });
  if (profileCount >= maxProfiles) {
    return NextResponse.json(
      {
        error:
          maxProfiles === 1
            ? "Ya tienes un nombre vigilado con este email. El plan Familiar permite hasta 5."
            : `Tu plan permite ${maxProfiles} nombres vigilados y ya los tienes todos en uso.`,
      },
      { status: 403 }
    );
  }

  // Perfil monitorizado.
  const profile = await prisma.monitoredProfile.create({
    data: {
      userId: user.id,
      fullName,
      searchKey: nameSearchKey(fullName),
      idType,
      fullDni: normalizeId(idNumberRaw),
      dniSuffix: idSuffix(idNumberRaw),
      provinces,
      kind: kindForIdType(idType),
    },
  });

  setSessionCookie(user.id);

  // Primer escaneo inmediato contra lo que ya esté indexado.
  let matches = 0;
  try {
    matches = await scanProfile(profile.id);
  } catch {
    // Si falla el escaneo, el alta no se pierde; el worker diario lo hará.
  }

  return NextResponse.json({ ok: true, matches, redirect: "/dashboard" });
}
