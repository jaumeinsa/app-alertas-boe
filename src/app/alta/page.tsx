import Link from "next/link";
import AltaForm from "@/components/AltaForm";
import { CONSENT_TEXT } from "@/lib/consent";
import { getSessionUser } from "@/lib/auth";
import { INK, CREAM, BLUE, CORAL, WHITE, DISPLAY, BRAND, SERIF } from "@/lib/theme";

export const metadata = {
  title: "Activar vigilancia",
  description: "Da de alta tu nombre para vigilar los boletines oficiales.",
};

export const dynamic = "force-dynamic";

function Logo() {
  return (
    <svg width={32} height={32} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill={INK} />
      <path d="M10 8h8l5 5v13H10z" stroke={CREAM} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M18 8v5h5" stroke={CREAM} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M13.5 18.5h8M13.5 22.5h5.5" stroke={CREAM} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="24" cy="9.5" r="3.1" fill={CORAL} stroke={INK} strokeWidth="1.5" />
    </svg>
  );
}

export default async function AltaPage({
  searchParams,
}: {
  searchParams: { bienvenida?: string };
}) {
  const user = await getSessionUser();
  const bienvenida = searchParams.bienvenida === "1";

  return (
    <main style={{ background: CREAM, minHeight: "100vh", color: INK }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 22px 64px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK }}>
          <Logo />
          <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 19 }}>Notifikado</span>
        </Link>

        {bienvenida && (
          <div
            style={{
              marginTop: 24,
              background: "rgba(44,91,208,.08)",
              border: `1px solid ${BLUE}`,
              borderRadius: 14,
              padding: "14px 18px",
              fontSize: 14.5,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: BLUE }}>✓ Pago confirmado.</strong> Tu suscripción está
            activa. Último paso: dinos qué nombre quieres vigilar.
          </div>
        )}

        <h1
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: "clamp(2rem,5vw,2.8rem)",
            letterSpacing: "-.03em",
            lineHeight: 1.05,
            margin: "28px 0 8px",
          }}
        >
          Activa tu <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>vigilancia</span>
        </h1>
        <p style={{ margin: "0 0 26px", fontSize: 16, color: "rgba(34,56,107,.72)", lineHeight: 1.55 }}>
          Vigilaremos todos los boletines oficiales y te avisaremos en cuanto tu nombre aparezca. Solo usamos tus datos para esto.
        </p>

        <div
          style={{
            background: WHITE,
            border: "1px solid rgba(34,56,107,.1)",
            borderRadius: 20,
            padding: "26px 24px",
            boxShadow: "0 18px 44px -30px rgba(44,91,208,.5)",
          }}
        >
          <AltaForm consentText={CONSENT_TEXT} initialEmail={user?.email} />
        </div>

        <p style={{ marginTop: 20, fontSize: 13.5, color: "rgba(34,56,107,.6)", textAlign: "center" }}>
          {user ? (
            <>
              Sesión iniciada como <strong>{user.email}</strong> ·{" "}
              <Link href="/dashboard" style={{ color: INK, fontWeight: 600 }}>
                Ir a mi panel
              </Link>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" style={{ color: INK, fontWeight: 600 }}>
                Entrar
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
