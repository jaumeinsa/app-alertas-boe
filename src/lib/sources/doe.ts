/**
 * Adaptador del DOE (Diario Oficial de Extremadura) — code `DOE`.
 *
 * Sumario HTML (iso-8859-1):
 *   https://doe.juntaex.es/ultimosdoe/mostrardoe.php?fecha=YYYYMMDD&t=o  (ordinario)
 *   ...&t=e  (extraordinario) — hay que probar ambos y unir.
 *     → enlaces `html.php?xml={id10}&anio={Y}&doe={issue}` (issue tipo "1230o"/"480e").
 * Texto (años recientes): HTML directo `otrosFormatos/html.php?...` (iso-8859-1, cuerpo completo).
 *   Fallback (años viejos sin HTML): PDF `/pdfs/doe/{Y}/{issue}/{id8}.pdf`, id8 = id10 sin los 2 primeros dígitos.
 * externalId = id10. Días sin boletín → sumario 200 con "D.O.E. No encontrado" y 0 enlaces → [].
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  fetchPdfText,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
  yyyymmdd,
} from "./util";

const SUM = "https://doe.juntaex.es/ultimosdoe/mostrardoe.php";
const HTMLDOC = "https://doe.juntaex.es/otrosFormatos/html.php";
const PDFBASE = "https://doe.juntaex.es/pdfs/doe";

interface DoeItem {
  id10: string;
  anio: string;
  doe: string;
}

/** Extrae (id10, anio, issue) de los enlaces html.php (tolera & y &amp;[amp;]). */
function parseSumario(html: string): DoeItem[] {
  const re =
    /html\.php\?xml=(\d{10})&(?:amp;)*anio=(\d{4})&(?:amp;)*doe=([0-9a-z]+)/g;
  const out: DoeItem[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, id10, anio, doe] = m;
    if (seen.has(id10)) continue;
    seen.add(id10);
    out.push({ id10, anio, doe });
  }
  return out;
}

/** Título a partir del cuerpo: el campo "Descriptores:" o el comienzo del texto. */
function titleFrom(text: string): string {
  const md = text.match(/Descriptores:\s*(.+?)\s*P[áa]gina\s+(?:de\s+)?Inicio/i);
  const base = md ? md[1] : text;
  return base.replace(/\s+/g, " ").trim().slice(0, 220);
}

export const doeAdapter: SourceAdapter = {
  code: "DOE",
  name: "Diario Oficial de Extremadura",
  type: "AUTONOMIC",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const ymd = yyyymmdd(date);
    const items = new Map<string, DoeItem>();
    for (const t of ["o", "e"]) {
      const sum = await fetchText(`${SUM}?fecha=${ymd}&t=${t}`, {
        charset: "iso-8859-1",
      });
      if (sum) for (const it of parseSumario(sum)) items.set(it.id10, it);
    }
    if (items.size === 0) return [];

    const out: NormalizedPublication[] = [];
    await mapPool([...items.values()], CONCURRENCY, async (it) => {
      // Preferimos el HTML (texto directo); si no, caemos al PDF.
      let url = `${HTMLDOC}?xml=${it.id10}&anio=${it.anio}&doe=${it.doe}`;
      const raw = await fetchText(url, { charset: "iso-8859-1" });
      let text = raw ? stripHtml(raw) : "";
      if (!text) {
        url = `${PDFBASE}/${it.anio}/${it.doe}/${it.id10.slice(2)}.pdf`;
        text = (await fetchPdfText(url)) ?? "";
      }
      if (!text) return;
      const title = titleFrom(text) || `DOE ${it.id10}`;
      out.push({
        externalId: it.id10,
        title,
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Extremadura",
      });
    });
    return out;
  },
};
