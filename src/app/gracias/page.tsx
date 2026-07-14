import Link from "next/link";
import { INK, CREAM, BLUE, WHITE, CORAL, DISPLAY, BRAND, SERIF } from "@/lib/theme";

export const metadata = {
  title: "Gracias — Notifikado",
  description: "Confirmación de tu suscripción a Notifikado.",
};

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

const COPY: Record<string, { title: string; body: string }> = {
  recibido: {
    title: "¡Pago recibido!",
    body: "Gracias por suscribirte. Te hemos enviado un email con tu enlace de acceso al panel. Si no lo ves en unos minutos, revisa el correo no deseado o entra con tu email desde la página de acceso.",
  },
  pendiente: {
    title: "Pago en proceso",
    body: "Tu pago se está procesando. En cuanto se confirme recibirás un email con el acceso a tu panel. Suele tardar solo unos minutos.",
  },
  error: {
    title: "No hemos podido confirmar el pago",
    body: "Si has completado el pago, no te preocupes: recibirás un email con tu acceso en cuanto Stripe nos lo confirme. Si el problema persiste, escríbenos a soporte@notifikado.com.",
  },
};

export default function GraciasPage({
  searchParams,
}: {
  searchParams: { estado?: string };
}) {
  const copy = COPY[searchParams.estado ?? "recibido"] ?? COPY.recibido;

  return (
    <main style={{ background: CREAM, minHeight: "100vh", color: INK }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 22px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK }}>
          <Logo />
          <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 19 }}>Notifikado</span>
        </Link>

        <h1
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: "clamp(2rem,5vw,2.6rem)",
            letterSpacing: "-.03em",
            lineHeight: 1.05,
            margin: "30px 0 12px",
          }}
        >
          {copy.title}{" "}
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, color: BLUE }}>✓</span>
        </h1>
        <p style={{ margin: "0 0 26px", fontSize: 16, color: "rgba(34,56,107,.75)", lineHeight: 1.6 }}>
          {copy.body}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link
            href="/login"
            style={{
              textDecoration: "none",
              background: BLUE,
              color: WHITE,
              fontWeight: 700,
              fontSize: 15,
              padding: "13px 24px",
              borderRadius: 100,
            }}
          >
            Entrar con mi email
          </Link>
          <Link
            href="/alta"
            style={{
              textDecoration: "none",
              color: INK,
              fontWeight: 600,
              fontSize: 15,
              padding: "13px 24px",
              borderRadius: 100,
              border: "1px solid rgba(34,56,107,.25)",
            }}
          >
            Configurar mi vigilancia
          </Link>
        </div>
      </div>
    </main>
  );
}
