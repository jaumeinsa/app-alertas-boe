import Link from "next/link";
import { INK, CREAM, BLUE, DISPLAY, BRAND } from "@/lib/theme";

export const metadata = {
  title: "Condiciones del servicio — Notifikado",
  description: "Condiciones de contratación del servicio de vigilancia de boletines oficiales.",
};

const P: React.CSSProperties = { fontSize: 15, lineHeight: 1.65, color: "rgba(34,56,107,.82)", margin: "0 0 16px" };
const H: React.CSSProperties = { fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: "-.02em", margin: "28px 0 10px", color: INK };
const LI: React.CSSProperties = { ...P, margin: "0 0 8px" };

export default function TerminosPage() {
  return (
    <main style={{ background: CREAM, minHeight: "100vh", color: INK }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 22px 64px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK }}>
          <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 18 }}>Notifikado</span>
        </Link>

        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "2.4rem", letterSpacing: "-.03em", margin: "24px 0 8px" }}>
          Condiciones del servicio
        </h1>
        <p style={{ ...P, color: "rgba(34,56,107,.6)", fontSize: 13.5 }}>
          Última actualización: 2 de julio de 2026
        </p>

        <h2 style={H}>1. Quién presta el servicio (aviso legal)</h2>
        <p style={P}>
          Notifikado (notifikado.com) es un servicio prestado por <strong>Jaume Insa Pérez</strong>,
          empresario individual, NIF 21693936Z, con domicilio en Placeta Fonda 4, 46410 Sueca
          (València), España, dado de alta en el epígrafe IAE 845 («Explotación electrónica por
          cuenta de terceros»). Contacto:{" "}
          <a href="mailto:avisos@notifikado.com" style={{ color: BLUE, fontWeight: 600 }}>avisos@notifikado.com</a>.
          Esta identificación se facilita en cumplimiento del artículo 10 de la Ley 34/2002 (LSSI-CE).
        </p>

        <h2 style={H}>2. Qué es Notifikado (y qué no es)</h2>
        <p style={P}>
          Notifikado es un servicio de <strong>alerta informativa</strong>: revisa a diario boletines y diarios oficiales
          españoles de acceso público y te avisa cuando detecta una posible aparición de los nombres que vigilas.
        </p>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px" }}>
          <li style={LI}><strong>No es asesoramiento jurídico</strong> ni sustituye a un abogado, gestor o procurador.</li>
          <li style={LI}><strong>No sustituye a las notificaciones oficiales</strong>: los plazos legales corren según lo publicado por la Administración, con independencia de nuestros avisos.</li>
          <li style={LI}>La detección es de <strong>mejor esfuerzo</strong>: dependemos de que las webs oficiales publiquen, estén disponibles y sean legibles. Pueden existir retrasos, boletines no cubiertos temporalmente, erratas de la fuente o coincidencias de homónimos (falsos positivos) y, excepcionalmente, apariciones no detectadas (falsos negativos).</li>
        </ul>

        <h2 style={H}>3. Precio, renovación y cancelación</h2>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px" }}>
          <li style={LI}>Los precios vigentes se muestran en la página principal e incluyen los impuestos aplicables. El pago se procesa a través de Stripe.</li>
          <li style={LI}>La suscripción se <strong>renueva automáticamente</strong> (mensual o anual según el plan) hasta que la canceles.</li>
          <li style={LI}><strong>Sin permanencia</strong>: puedes cancelar cuando quieras escribiendo a avisos@notifikado.com o desde el enlace de gestión de Stripe en tus recibos; la vigilancia sigue activa hasta el final del periodo ya pagado.</li>
          <li style={LI}>Eliminar tu cuenta desde el panel cancela también la renovación de tu suscripción.</li>
        </ul>

        <h2 style={H}>4. Derecho de desistimiento</h2>
        <p style={P}>
          Al contratar solicitas que el servicio comience de inmediato. Aun así, si no quedas satisfecho dispones de
          14 días naturales desde la contratación para desistir escribiendo a avisos@notifikado.com; te reembolsaremos
          el importe pagado descontando, en su caso, la parte proporcional del servicio ya prestado.
        </p>

        <h2 style={H}>5. Uso correcto</h2>
        <p style={P}>
          Solo puedes vigilar tu propio nombre, los de personas que te hayan autorizado expresamente (p. ej. familiares
          en el plan Familiar) o entidades que representes. No está permitido usar el servicio para vigilar a terceros
          sin su consentimiento ni para fines distintos de la recepción de avisos personales.
        </p>

        <h2 style={H}>6. Responsabilidad</h2>
        <p style={P}>
          Prestamos el servicio con diligencia profesional, pero —en la medida en que la ley lo permite— no respondemos
          de daños derivados de plazos legales incumplidos, sanciones, embargos u otras consecuencias de publicaciones
          oficiales, tanto si fueron detectadas y avisadas como si no. Nuestra responsabilidad total queda limitada al
          importe pagado por el servicio en los 12 meses anteriores al hecho que la origine.
        </p>

        <h2 style={H}>7. Ley aplicable</h2>
        <p style={P}>
          Estas condiciones se rigen por la legislación española. Para cualquier controversia serán competentes los
          juzgados que correspondan conforme a la normativa de consumidores.
        </p>

        <p style={{ ...P, marginTop: 28 }}>
          <Link href="/privacidad" style={{ color: BLUE, fontWeight: 600 }}>Política de privacidad</Link>
          {" · "}
          <Link href="/" style={{ color: BLUE, fontWeight: 600 }}>← Volver al inicio</Link>
        </p>
      </div>
    </main>
  );
}
