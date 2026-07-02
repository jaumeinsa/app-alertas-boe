/**
 * Plantillas HTML de los emails transaccionales (enlace de acceso, bienvenida
 * tras el pago y aviso de coincidencias). HTML de tabla con estilos en línea
 * para máxima compatibilidad con clientes de correo.
 */

const INK = "#22386B";
const CREAM = "#F3EFE4";
const BLUE = "#2C5BD0";
const CORAL = "#E8552D";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://notifikado.com";

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:${CREAM};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:0 4px 18px;">
          <span style="font-size:19px;font-weight:800;color:${INK};">Notifikado<span style="color:${CORAL};">.</span></span>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid rgba(34,56,107,.12);border-radius:16px;padding:28px;">
          <h1 style="margin:0 0 14px;font-size:21px;line-height:1.25;color:${INK};">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 4px 0;font-size:12px;line-height:1.5;color:rgba(34,56,107,.55);">
          Notifikado · vigilancia de boletines oficiales · <a href="${APP_URL}/privacidad" style="color:rgba(34,56,107,.55);">Privacidad</a><br>
          Recibes este correo porque tienes una cuenta en notifikado.com.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="background:${BLUE};border-radius:100px;">
    <a href="${href}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;">${text}</a>
  </td></tr></table>`;
}

const p = (html: string) =>
  `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:${INK};">${html}</p>`;
const muted = (html: string) =>
  `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:rgba(34,56,107,.6);">${html}</p>`;

export function magicLinkEmail(link: string): { subject: string; html: string } {
  return {
    subject: "Tu enlace de acceso a Notifikado",
    html: layout(
      "Entra en tu panel",
      p("Pulsa el botón para acceder a tu panel de vigilancia. El enlace caduca en 30 minutos y solo puede usarse una vez.") +
        button(link, "Entrar en Notifikado") +
        muted("Si no has solicitado este acceso, puedes ignorar este mensaje sin más."),
    ),
  };
}

export function welcomeEmail(link: string, planLabel: string): { subject: string; html: string } {
  return {
    subject: "Pago confirmado — activa tu vigilancia",
    html: layout(
      "¡Bienvenido a Notifikado!",
      p(`Tu pago del plan <strong>${planLabel}</strong> se ha procesado correctamente.`) +
        p("Solo falta un paso: dinos qué nombre quieres vigilar para empezar a revisar los boletines oficiales cada día.") +
        button(link, "Configurar mi vigilancia") +
        muted("Este enlace de acceso caduca en 30 minutos. Si caduca, pide uno nuevo en notifikado.com/login con este mismo email."),
    ),
  };
}

export interface MatchEmailItem {
  profileName: string;
  title: string;
  sourceCode: string;
  publishedAt: Date;
  url: string;
}

export function matchesEmail(items: MatchEmailItem[]): { subject: string; html: string } {
  const shown = items.slice(0, 20);
  const rest = items.length - shown.length;
  const rows = shown
    .map(
      (m) => `<tr>
        <td style="padding:12px 0;border-top:1px solid rgba(34,56,107,.1);">
          <div style="font-size:12px;color:rgba(34,56,107,.6);margin-bottom:4px;">
            <strong style="color:${BLUE};">${m.sourceCode}</strong> · ${m.publishedAt.toLocaleDateString("es-ES")} · vigilando: ${m.profileName}
          </div>
          <div style="font-size:14px;line-height:1.45;color:${INK};margin-bottom:6px;">${m.title}</div>
          <a href="${m.url}" style="font-size:13px;color:${BLUE};font-weight:600;">Ver documento oficial →</a>
        </td>
      </tr>`,
    )
    .join("");
  const n = items.length;
  return {
    subject:
      n === 1
        ? "⚠️ Tu nombre ha aparecido en un boletín oficial"
        : `⚠️ ${n} coincidencias nuevas en boletines oficiales`,
    html: layout(
      n === 1 ? "Hemos detectado una coincidencia" : `Hemos detectado ${n} coincidencias`,
      p("Tu vigilancia ha encontrado tu nombre en publicaciones oficiales recientes o del histórico:") +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0;">${rows}</table>` +
        (rest > 0 ? p(`… y ${rest} más en tu panel.`) : "") +
        button(`${APP_URL}/dashboard`, "Revisar en mi panel") +
        muted("Revisa cada documento y confirma o descarta la coincidencia en tu panel. Los plazos administrativos corren desde la publicación."),
    ),
  };
}
