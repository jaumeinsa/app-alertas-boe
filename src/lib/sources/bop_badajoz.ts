/**
 * Adaptador del BOP de Badajoz (Diputación de Badajoz) — code `BOP_06`.
 *
 * Plataforma propia `dip-badajoz.es/bop`, todo HTML (2 GET, sin sesión):
 *   1) Sumario del día: /bop/index.php?FechaSolicitada=YYYYMMDD
 *        → dentro de <div id="sumario_dinamico">, cada anuncio es un enlace
 *          ventana_anuncio.php?id_anuncio={ID}&amp;FechaSolicitada={YYYYMMDD}000000
 *          con title="Anuncio {NUM} / {AÑO}" y el título como texto del enlace.
 *          200 con 0 anuncios = día sin boletín (finde/festivo) → [].
 *        ⚠️ El pie de página lleva un enlace fijo a un anuncio de 2009 con
 *          FechaSolicitada=2009-12-24 (no 14 dígitos); además se filtra que la
 *          fecha14 empiece por el YYYYMMDD pedido.
 *   2) Texto íntegro: /bop/ventana_anuncio.php?id_anuncio={ID}&FechaSolicitada={fecha14}
 *        → HTML con el cuerpo completo en <div class="contenido_anuncio">
 *          (nombres de personas en edictos/notificaciones). Charset UTF-8.
 *
 * externalId = "{NUM}/{AÑO}" (numeración oficial del boletín, única y estable).
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
  yyyymmdd,
} from "./types";
import {
  CONCURRENCY,
  fetchText,
  mapPool,
  MAX_BODY_CHARS,
  stripHtml,
} from "./util";

const BASE = "https://www.dip-badajoz.es/bop";

interface Entry {
  idAnuncio: string;
  fecha14: string;
  externalId: string; // "NUM/AÑO"
  title: string;
}

/** Extrae los anuncios del sumario del día (filtrando el enlace fijo del pie). */
function parseSumario(html: string, ymd: string): Entry[] {
  // Acotar al sumario si el marcador existe (el pie lleva un anuncio de 2009).
  const idx = html.indexOf('id="sumario_dinamico"');
  const scope = idx >= 0 ? html.slice(idx) : html;

  const re =
    /ventana_anuncio\.php\?id_anuncio=(\d+)&amp;FechaSolicitada=(\d{14})"\s+title="Anuncio (\d+) \/ (\d{4})"[^>]*>([^<]+)</g;
  const out: Entry[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(scope))) {
    const [, idAnuncio, fecha14, num, anyo, rawTitle] = m;
    if (!fecha14.startsWith(ymd)) continue; // descarta anuncios de otra fecha
    const externalId = `${num}/${anyo}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    out.push({ idAnuncio, fecha14, externalId, title: stripHtml(rawTitle) });
  }
  return out;
}

/** Texto del anuncio: cuerpo desde <div class="contenido_anuncio"> (o página entera). */
function extractBody(html: string): string {
  const m = /<div class="contenido_anuncio"[^>]*>([\s\S]*)/.exec(html);
  return stripHtml(m ? m[1] : html);
}

export const bopBadajozAdapter: SourceAdapter = {
  code: "BOP_06",
  name: "Boletín Oficial de la Provincia de Badajoz",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const ymd = yyyymmdd(date);
    const sumario = await fetchText(`${BASE}/index.php?FechaSolicitada=${ymd}`);
    if (!sumario) return [];

    const entries = parseSumario(sumario, ymd);
    if (entries.length === 0) return []; // día sin boletín

    const out: NormalizedPublication[] = [];
    await mapPool(entries, CONCURRENCY, async (e) => {
      const url = `${BASE}/ventana_anuncio.php?id_anuncio=${e.idAnuncio}&FechaSolicitada=${e.fecha14}`;
      const html = await fetchText(url);
      if (!html) return; // error puntual de un anuncio → no tumbar el día
      const title = e.title || `BOP Badajoz ${e.externalId}`;
      out.push({
        externalId: e.externalId,
        title: title.slice(0, 300),
        searchText: `${title}\n${extractBody(html)}`.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Badajoz",
      });
    });
    return out;
  },
};
