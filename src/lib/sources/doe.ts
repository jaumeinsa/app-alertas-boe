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
 *
 * FORMATO VIEJO (2020 – abr-2022): la sede cambió alrededor de MAY-2022. Antes,
 * el sumario NO trae ningún enlace html.php: cada disposición aparece como
 * enlace PDF directo `/pdfs/doe/{Y}/{issue}/{fichero}.pdf` (más su ELI). Para
 * ese tramo emitimos un doc por cada PDF (externalId = nombre del fichero, único;
 * texto = fetchPdfText), ignorando el PDF del boletín completo (fichero === issue,
 * p.ej. 310o.pdf) para no duplicarlo todo. Los sumarios recientes traen AMBOS
 * (html.php y /pdfs/doe): por eso el camino PDF-directo solo actúa si NO hay
 * ningún html.php, dejando intacto el camino nuevo que ya funciona.
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

const ORIGIN = "https://doe.juntaex.es";
const SUM = `${ORIGIN}/ultimosdoe/mostrardoe.php`;
const HTMLDOC = `${ORIGIN}/otrosFormatos/html.php`;
const PDFBASE = `${ORIGIN}/pdfs/doe`;

interface DoeItem {
  id10: string;
  anio: string;
  doe: string;
}

/** Enlace PDF directo del sumario viejo (2020 – abr-2022). */
interface DoePdf {
  /** Nombre del fichero PDF sin extensión (p.ej. "21040006", "21ED0032"). */
  externalId: string;
  url: string;
  /** Título limpio tomado del sumario, si se pudo emparejar (puede ser ""). */
  title: string;
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

/**
 * Formato viejo (2020 – abr-2022): extrae los enlaces PDF directos del sumario
 * `/pdfs/doe/{Y}/{issue}/{fichero}.pdf`, uno por disposición. Ignora el PDF del
 * boletín completo (fichero === issue) para no duplicar todo el boletín, y
 * empareja cada enlace con el título limpio (`<span class="DOE4">…`) que lo
 * precede en el sumario, cuando existe.
 */
function parsePdfLinks(html: string): DoePdf[] {
  // Títulos del sumario en orden de aparición, con su posición.
  const titles: Array<{ at: number; text: string }> = [];
  const tre = /<span class="DOE4">([\s\S]*?)<\/span>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tre.exec(html))) {
    titles.push({ at: tm.index, text: stripHtml(tm[1]) });
  }

  const out: DoePdf[] = [];
  const seen = new Set<string>();
  const re = /\/pdfs\/doe\/\d{4}\/([0-9a-z]+)\/([0-9a-z]+)\.pdf/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const issue = m[1];
    const file = m[2];
    // El PDF cuyo nombre coincide con la edición es el boletín completo → fuera.
    if (file.toLowerCase() === issue.toLowerCase()) continue;
    if (seen.has(file)) continue;
    seen.add(file);
    // Título = el último DOE4 que aparece ANTES del enlace (van en orden).
    let title = "";
    for (const t of titles) {
      if (t.at < m.index) title = t.text;
      else break;
    }
    out.push({ externalId: file, url: `${ORIGIN}${m[0]}`, title });
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
    const pdfs = new Map<string, DoePdf>();
    for (const t of ["o", "e"]) {
      const sum = await fetchText(`${SUM}?fecha=${ymd}&t=${t}`, {
        charset: "iso-8859-1",
      });
      if (!sum) continue;
      for (const it of parseSumario(sum)) items.set(it.id10, it);
      for (const p of parsePdfLinks(sum)) pdfs.set(p.externalId, p);
    }

    // Camino nuevo (2022-05+): enlaces html.php. Los sumarios recientes traen
    // TAMBIÉN /pdfs/doe, así que solo caemos al camino PDF-directo si no hay
    // ningún html.php — así este tramo queda exactamente como estaba.
    if (items.size > 0) {
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
    }

    // Camino viejo (2020 – abr-2022): sumario sin html.php, solo PDFs directos.
    if (pdfs.size > 0) {
      const out: NormalizedPublication[] = [];
      await mapPool([...pdfs.values()], CONCURRENCY, async (p) => {
        const text = (await fetchPdfText(p.url)) ?? "";
        if (!text) return;
        const title = p.title || titleFrom(text) || `DOE ${p.externalId}`;
        out.push({
          externalId: p.externalId,
          title,
          searchText: text.slice(0, MAX_BODY_CHARS),
          url: p.url,
          publishedAt: date,
          actType: inferActType(title),
          region: "Extremadura",
        });
      });
      return out;
    }

    return [];
  },
};
