/**
 * Adaptador del BOPZ (Boletín Oficial de la Provincia de Zaragoza, 50).
 * App Struts `bop.dpz.es/BOPZ` (sin cookies/jsessionid necesarios).
 *
 * Buscador por fecha vía POST (20 edictos/página, se pagina con numPag):
 *   POST /BOPZ/portalBuscarEdictos.do
 *   body: fechaPubInf=DD/MM/YYYY & fechaPubSup=DD/MM/YYYY & numPag={0,1,2…} & ...
 *   HTML ISO-8859-1: cada resultado es un <div class="row listadoEdictos">
 *   con onclick edita('{idEdicto}',...) y el nº de registro "NUM/AÑO".
 * Texto completo del edicto (sin PDF):
 *   GET /BOPZ/obtenerContenidoEdicto.do?idEdicto={ID}  → HTML con el cuerpo.
 * externalId = idEdicto. Desde IP residencial (el WAF corta datacenters).
 * La cadena TLS es incompleta para Node (curl la acepta) → insecure:true.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  ddmmyyyy,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
} from "./util";

const BASE = "https://bop.dpz.es/BOPZ";
const MAX_PAGES = 15; // 20/página → tope 300 edictos/día (holgado)

interface ZgzEdicto {
  id: string;
  reg: string; // "NUM/AÑO"
  titulo: string;
}

/** Extrae los edictos de una página de resultados (latin-1 decodificado). */
function parsePagina(html: string): ZgzEdicto[] {
  const out: ZgzEdicto[] = [];
  const seen = new Set<string>();
  // Troceamos por cada fila <div class="row listadoEdictos"> (columnas dentro:
  // large-1 Nº Reg, large-4 Sumario, etc., todas con onclick edita('ID',...)).
  const rows = html.split(/class="row listadoEdictos"/).slice(1);
  for (const block of rows) {
    const id = /edita\('(\d+)'/.exec(block)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    // Nº de registro: "Nº. Reg:&nbsp;</span>4006/2026".
    const reg = (/(\d{1,7}\s*\/\s*\d{4})/.exec(block)?.[1] ?? "").replace(/\s+/g, "");
    // Sumario: <span style="padding-left:4px;">TÍTULO</span>.
    const sumM = /padding-left:4px;">([\s\S]*?)<\/span>/.exec(block);
    const titulo = sumM ? stripHtml(sumM[1]) : "";
    out.push({ id, reg, titulo });
  }
  return out;
}

export const bopZaragozaAdapter: SourceAdapter = {
  code: "BOP_50",
  name: "Boletín Oficial de la Provincia de Zaragoza",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const f = ddmmyyyy(date, "/"); // DD/MM/YYYY
    const edictos: ZgzEdicto[] = [];
    const seen = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const html = await fetchText(`${BASE}/portalBuscarEdictos.do`, {
        method: "POST",
        body: {
          numPag: String(page),
          primeraVez: "N",
          ficheroDoc: "N",
          esPortalSN: "S",
          fechaPubInf: f,
          fechaPubSup: f,
          numRegistroInf: "",
          numRegistroSup: "",
          numBoletinInf: "",
          numBoletinSup: "",
          anyoBoletinInf: "",
          anyoBoletinSup: "",
          procedente: "",
          seccion: "",
          tematica: "",
          titulo: "",
          contenido: "",
        },
        charset: "iso-8859-1",
        insecure: true,
      });
      if (!html) break;
      const pageEdictos = parsePagina(html).filter((e) => !seen.has(e.id));
      if (pageEdictos.length === 0) break; // sin filas nuevas → fin
      for (const e of pageEdictos) {
        seen.add(e.id);
        edictos.push(e);
      }
    }

    if (edictos.length === 0) return [];

    const out: NormalizedPublication[] = edictos.map((e) => ({
      externalId: `BOP_50-${e.id}`,
      title: (e.titulo || `BOPZ ${e.reg}`).slice(0, 300),
      searchText: e.titulo,
      url: `${BASE}/obtenerContenidoEdicto.do?idEdicto=${e.id}`,
      publishedAt: date,
      actType: inferActType(e.titulo),
      region: "Zaragoza",
    }));

    // Texto completo de cada edicto (HTML propio, no PDF).
    await mapPool(out, CONCURRENCY, async (pub, i) => {
      const html = await fetchText(
        `${BASE}/obtenerContenidoEdicto.do?idEdicto=${edictos[i].id}`,
        { charset: "iso-8859-1", insecure: true }
      );
      if (html) {
        const text = stripHtml(html);
        if (text.length > 30) pub.searchText = text.slice(0, MAX_BODY_CHARS);
      }
    });

    return out;
  },
};
