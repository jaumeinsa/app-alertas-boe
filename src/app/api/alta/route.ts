import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createLoginToken, getSessionUser, setSessionCookie } from "@/lib/auth";
import { CONSENT_VERSION } from "@/lib/consent";
import { detectIdType, idSuffix, isValidDniNie, kindForIdType } from "@/lib/ids";
import { nameSearchKey } from "@/lib/matching/normalize";
import { tokenizeName } from "@/lib/matching/normalize";
import { magicLinkEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/mail";
import { scanProfile } from "@/lib/scan";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

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

  // Resolución de la cuenta (anti-secuestro): el email del formulario NUNCA
  // da acceso a una cuenta existente sin demostrar su propiedad.
  const sessionUser = await getSessionUser();
  let user;
  if (sessionUser) {
    // Con sesión iniciada, el alta añade el perfil a ESA cuenta; el email del
    // formulario no puede cambiarla.
    user = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        ...(phone ? { phone } : {}),
        consentAt: new Date(),
        consentVersion: CONSENT_VERSION,
      },
      include: { subscription: true },
    });
  } else {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // La cuenta ya existe y quien envía el formulario no ha demostrado ser
      // su dueño: le mandamos un enlace de acceso a SU correo y no tocamos nada.
      const { token } = await createLoginToken(email);
      const link = `${APP_URL}/api/auth/verify?token=${token}`;
      const tpl = magicLinkEmail(link);
      const mail = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
      return NextResponse.json(
        { accountExists: true, emailed: mail.sent },
        { status: 409 }
      );
    }
    user = await prisma.user.create({
      data: {
        email,
        phone,
        consentAt: new Date(),
        consentVersion: CONSENT_VERSION,
      },
      include: { subscription: true },
    });
  }

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
      // Minimización RGPD: el documento completo NO se almacena; solo se usa
      // aquí para validar la letra y derivar el sufijo con el que casan los
      // boletines anonimizados ("***4567**").
      idType,
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
