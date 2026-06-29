import Link from "next/link";
import { CONSENT_TEXT } from "@/lib/consent";
import { INK, CREAM, BLUE, DISPLAY, BRAND } from "@/lib/theme";

export const metadata = {
  title: "Privacidad",
  description: "Cómo trata Notifikado tus datos personales.",
};

const P: React.CSSProperties = { fontSize: 15, lineHeight: 1.65, color: "rgba(34,56,107,.82)", margin: "0 0 16px" };
const H: React.CSSProperties = { fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: "-.02em", margin: "28px 0 10px", color: INK };

export default function PrivacidadPage() {
  return (
    <main style={{ background: CREAM, minHeight: "100vh", color: INK }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 22px 64px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK }}>
          <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 18 }}>Notifikado</span>
        </Link>

        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "2.4rem", letterSpacing: "-.03em", margin: "24px 0 8px" }}>
          Política de privacidad
        </h1>
        <p style={{ ...P, color: "rgba(34,56,107,.6)", fontSize: 13.5 }}>Última actualización: junio de 2026</p>

        <h2 style={H}>Qué datos tratamos</h2>
        <p style={P}>
          Tu nombre completo, tu documento de identidad (DNI, NIE o CIF), tu email y, si lo facilitas, tu teléfono y provincia.
        </p>

        <h2 style={H}>Para qué los usamos</h2>
        <p style={P}>{CONSENT_TEXT}</p>
        <p style={P}>
          Concretamente: vigilamos publicaciones oficiales del Estado (BOE, Tablón Edictal Único, BORME, boletines provinciales y autonómicos) buscando tu nombre, y te avisamos por email (y WhatsApp si nos das el teléfono) cuando aparece. No usamos tus datos para ninguna otra finalidad ni los vendemos o cedemos a terceros.
        </p>

        <h2 style={H}>Base legal</h2>
        <p style={P}>
          Tu consentimiento explícito, prestado al activar la vigilancia, y la ejecución del servicio que contratas.
        </p>

        <h2 style={H}>Conservación</h2>
        <p style={P}>
          Conservamos tus datos mientras mantengas la vigilancia activa. Si das de baja y solicitas la supresión, los eliminamos.
        </p>

        <h2 style={H}>Tus derechos</h2>
        <p style={P}>
          Puedes acceder, rectificar, suprimir tus datos y revocar el consentimiento en cualquier momento escribiéndonos a{" "}
          <a href="mailto:avisos@notifikado.com" style={{ color: BLUE, fontWeight: 600 }}>
            avisos@notifikado.com
          </a>
          .
        </p>

        <p style={{ ...P, marginTop: 28 }}>
          <Link href="/alta" style={{ color: BLUE, fontWeight: 600 }}>
            ← Volver al alta
          </Link>
        </p>
      </div>
    </main>
  );
}
