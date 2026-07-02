import Link from "next/link";
import { CONSENT_TEXT } from "@/lib/consent";
import { INK, CREAM, BLUE, DISPLAY, BRAND } from "@/lib/theme";

export const metadata = {
  title: "Política de privacidad — Notifikado",
  description: "Cómo trata Notifikado tus datos personales conforme al RGPD.",
};

const P: React.CSSProperties = { fontSize: 15, lineHeight: 1.65, color: "rgba(34,56,107,.82)", margin: "0 0 16px" };
const H: React.CSSProperties = { fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: "-.02em", margin: "28px 0 10px", color: INK };
const LI: React.CSSProperties = { ...P, margin: "0 0 8px" };

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
        <p style={{ ...P, color: "rgba(34,56,107,.6)", fontSize: 13.5 }}>
          Última actualización: 2 de julio de 2026 · versión 2026-07-v2
        </p>

        <h2 style={H}>Responsable del tratamiento</h2>
        <p style={P}>
          Jaume Insa Pérez, NIF 21693936Z (España), titular de Notifikado (notifikado.com).
          Contacto para cualquier asunto de privacidad:{" "}
          <a href="mailto:avisos@notifikado.com" style={{ color: BLUE, fontWeight: 600 }}>avisos@notifikado.com</a>.
        </p>

        <h2 style={H}>Qué datos tratamos</h2>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px" }}>
          <li style={LI}><strong>Cuenta:</strong> email y, si lo facilitas, teléfono.</li>
          <li style={LI}><strong>Vigilancia:</strong> nombre completo a vigilar, tipo de documento (DNI/NIE/CIF) y sus <strong>últimos dígitos</strong>, y provincia si la indicas. <strong>El documento completo no se almacena</strong>: se usa solo en el momento del alta para validarlo y derivar los últimos dígitos.</li>
          <li style={LI}><strong>Facturación:</strong> la gestiona Stripe; nosotros solo guardamos identificadores de cliente/suscripción y el estado del plan. No vemos ni almacenamos tu tarjeta.</li>
          <li style={LI}><strong>Coincidencias:</strong> las apariciones detectadas de tu nombre en boletines oficiales (que son publicaciones públicas).</li>
        </ul>

        <h2 style={H}>Para qué y con qué base legal</h2>
        <p style={P}>{CONSENT_TEXT}</p>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px" }}>
          <li style={LI}><strong>Vigilancia y avisos</strong> — tu consentimiento expreso (art. 6.1.a RGPD), prestado al activar la vigilancia.</li>
          <li style={LI}><strong>Cuenta, acceso, facturación y emails de servicio</strong> — ejecución del contrato (art. 6.1.b RGPD).</li>
          <li style={LI}><strong>Conservación de facturas</strong> — obligación legal tributaria (art. 6.1.c RGPD).</li>
        </ul>
        <p style={P}>No usamos tus datos para ninguna otra finalidad. No hay publicidad, no hay perfilado, no vendemos ni cedemos datos.</p>

        <h2 style={H}>Encargados del tratamiento (proveedores)</h2>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px" }}>
          <li style={LI}><strong>Stripe Payments Europe</strong> — procesamiento de pagos (posibles transferencias a EE. UU. amparadas en el EU-US Data Privacy Framework y cláusulas contractuales tipo).</li>
          <li style={LI}><strong>Resend</strong> — envío de emails, con servidores en la UE (región eu-west-1).</li>
          <li style={LI}><strong>Hostinger</strong> — alojamiento del servicio y de la base de datos, en centros de datos de la UE.</li>
        </ul>

        <h2 style={H}>Conservación</h2>
        <p style={P}>
          Mantenemos tus datos mientras tu cuenta exista. Si eliminas tu cuenta desde el panel, todos tus datos personales
          (perfil vigilado, coincidencias, preferencias y tokens de acceso) se borran de forma inmediata e irreversible;
          solo se conservan los justificantes de facturación durante los plazos que exige la normativa tributaria.
        </p>

        <h2 style={H}>Tus derechos</h2>
        <p style={P}>
          Puedes ejercer en cualquier momento tus derechos de <strong>acceso, rectificación, supresión, oposición,
          limitación del tratamiento y portabilidad</strong>:
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px" }}>
          <li style={LI}>Desde tu panel: gestiona los canales de aviso o usa <strong>“Eliminar mi cuenta y mis datos”</strong> (supresión completa, sin pasos intermedios).</li>
          <li style={LI}>Por email: <a href="mailto:avisos@notifikado.com" style={{ color: BLUE, fontWeight: 600 }}>avisos@notifikado.com</a>. Respondemos en un máximo de 30 días.</li>
          <li style={LI}>Si crees que no hemos atendido bien tus derechos, puedes reclamar ante la <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" style={{ color: BLUE, fontWeight: 600 }}>Agencia Española de Protección de Datos</a>.</li>
        </ul>

        <h2 style={H}>Cookies</h2>
        <p style={P}>
          Solo usamos una cookie técnica de sesión (imprescindible para que puedas entrar en tu panel). No hay cookies de
          analítica, publicidad ni seguimiento, por lo que no se requiere banner de consentimiento de cookies.
        </p>

        <h2 style={H}>Seguridad y menores</h2>
        <p style={P}>
          Todo el tráfico va cifrado (HTTPS), la base de datos no es accesible desde Internet y aplicamos minimización de
          datos (no guardamos tu documento completo). El servicio está dirigido a mayores de 14 años.
        </p>

        <p style={{ ...P, marginTop: 28 }}>
          <Link href="/terminos" style={{ color: BLUE, fontWeight: 600 }}>Condiciones del servicio</Link>
          {" · "}
          <Link href="/" style={{ color: BLUE, fontWeight: 600 }}>← Volver al inicio</Link>
        </p>
      </div>
    </main>
  );
}
