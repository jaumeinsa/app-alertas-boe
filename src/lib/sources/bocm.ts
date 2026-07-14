/**
 * Adaptador del BOCM (Boletín Oficial de la Comunidad de Madrid) — code `BOCM`.
 *
 * GIGANTE: ~4.000-6.000 disposiciones/día (muchísimo anuncio municipal = edictos
 * personales de alto valor). Todo en XML.
 *   1) Resolver nº del día: probar CM_{Tipo}_BOCM/{Y}/{M}/{D}/BOCM-{YYYYMMDD}-1.xml
 *      (doc 1 va siempre bajo "Orden") → leer <diario_numero>.
 *   2) Sumario: CM_Boletin_BOCM/{Y}/{M}/{D}/BOCM-{YYYYMMDD}{NNN}.xml (NNN 3 dígitos).
 *      → cada <disposicion>: <identificador>, <titulo>, <url_xml>, <url_html>.
 *   3) Texto de cada disposición: su <url_xml> → contenido en <texto>.
 *      ⚠️ El <url_xml> del sumario a veces trae fecha interna errónea (404) →
 *         reconstruimos la ruta con la fecha del sumario + el nº del identificador.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
} from "./util";

const BASE = "https://www.bocm.es/boletin";
// El doc 1 va bajo "Orden" en todas las fechas probadas (2020-2025); el resto
// son fallback por si algún día cambia.
const TIPOS = [
  "Orden",
  "Resolucion",
  "Anuncio",
  "Decreto",
  "Acuerdo",
  "Ley",
  "Otras_Disposiciones",
];

const pad = (n: number) => String(n).padStart(2, "0");

interface Disp {
  id: string;
  titulo: string;
  urlXml: string;
  urlHtml: string;
}

function firstGroup(re: RegExp, s: string): string {
  const m = s.match(re);
  return m ? m[1] : "";
}

function parseDisposiciones(sumario: string): Disp[] {
  const out: Disp[] = [];
  const seen = new Set<string>();
  const re = /<disposicion\b[^>]*>([\s\S]*?)<\/disposicion>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sumario))) {
    const block = m[1];
    const id = firstGroup(/<identificador>([^<]+)<\/identificador>/, block);
    const urlXml = firstGroup(/<url_xml>([^<]+)<\/url_xml>/, block);
    if (!id || !urlXml || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      titulo: stripHtml(firstGroup(/<titulo>([\s\S]*?)<\/titulo>/, block)),
      urlXml,
      urlHtml: firstGroup(/<url_html>([^<]+)<\/url_html>/, block),
    });
  }
  return out;
}

async function resolveNumero(
  y: number,
  m: string,
  d: string,
  ymd: string
): Promise<string | null> {
  for (const tipo of TIPOS) {
    const xml = await fetchText(
      `${BASE}/CM_${tipo}_BOCM/${y}/${m}/${d}/BOCM-${ymd}-1.xml`
    );
    const num = xml && firstGroup(/<diario_numero>(\d+)<\/diario_numero>/, xml);
    if (num) return num;
  }
  return null;
}

export const bocmAdapter: SourceAdapter = {
  code: "BOCM",
  name: "Boletín Oficial de la Comunidad de Madrid",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const y = date.getUTCFullYear();
    const m = pad(date.getUTCMonth() + 1);
    const d = pad(date.getUTCDate());
    const ymd = `${y}${m}${d}`;

    const numero = await resolveNumero(y, m, d, ymd);
    if (!numero) return []; // sin boletín ese día

    const sumario = await fetchText(
      `${BASE}/CM_Boletin_BOCM/${y}/${m}/${d}/BOCM-${ymd}${numero.padStart(3, "0")}.xml`
    );
    if (!sumario) return [];

    const disps = parseDisposiciones(sumario);
    if (disps.length === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool(disps, CONCURRENCY, async (dp) => {
      let docXml = await fetchText(dp.urlXml);
      if (!docXml) {
        // Fallback: reconstruir la ruta con la fecha correcta del sumario.
        const tipo = firstGroup(/CM_([^_/]+)_BOCM/, dp.urlXml);
        const n = firstGroup(/-(\d+)$/, dp.id);
        if (tipo && n) {
          docXml = await fetchText(
            `${BASE}/CM_${tipo}_BOCM/${y}/${m}/${d}/BOCM-${ymd}-${n}.xml`
          );
        }
      }
      const texto = docXml
        ? stripHtml(firstGroup(/<texto>([\s\S]*?)<\/texto>/, docXml))
        : "";
      if (!texto && !dp.titulo) return;
      const title = dp.titulo || `BOCM ${dp.id}`;
      out.push({
        externalId: dp.id,
        title: title.slice(0, 300),
        searchText: `${dp.titulo}\n${texto}`.slice(0, MAX_BODY_CHARS),
        url: dp.urlHtml || dp.urlXml,
        publishedAt: date,
        actType: inferActType(dp.titulo),
        region: "Madrid",
      });
    });
    return out;
  },
};
