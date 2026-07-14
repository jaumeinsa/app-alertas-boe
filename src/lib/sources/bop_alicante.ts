/**
 * Adaptador del BOP de Alicante — code `BOP_03`.
 *
 * API AJAX del WordPress de la sede (descubierta vía inspección de red):
 *   GET .../webservices/wseConsultaAjax.php?nemo=BOP_EDI&param={XML}&usuario=-
 *     XML: <raiz><entrada><registro><desde>DD/MM/YYYY</desde><hasta>DD/MM/YYYY</hasta>
 *          <texto/><tipoorganismo/><publicante/></registro></entrada></raiz>
 *   → JSON { bop: { registro: [{ edicto:["4457"], extracto:[...], ubicacion:["<pdf>"] }] } }
 *   PDF: campo `ubicacion` (dip-alicante.es, cert roto → insecure).
 * externalId = YYYY-edicto.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  CONCURRENCY,
  fetchJson,
  fetchPdfText,
  MAX_BODY_CHARS,
  mapPool,
} from "./util";

const API =
  "https://sede.diputacionalicante.es/wp-content/themes/Desarrollo-Diputacion/webservices/wseConsultaAjax.php";
const pad = (n: number) => String(n).padStart(2, "0");

interface AliReg {
  edicto?: string[];
  extracto?: string[];
  ubicacion?: string[];
}

export const bopAlicanteAdapter: SourceAdapter = {
  code: "BOP_03",
  name: "Boletín Oficial de la Provincia de Alicante",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const f = `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
    const xml =
      `<raiz><entrada><registro><desde>${f}</desde><hasta>${f}</hasta>` +
      `<texto></texto><tipoorganismo></tipoorganismo><publicante></publicante></registro></entrada></raiz>`;
    const data = (await fetchJson(
      `${API}?nemo=BOP_EDI&param=${encodeURIComponent(xml)}&usuario=-`
    )) as { bop?: { registro?: AliReg[] | AliReg } } | null;

    const raw = data?.bop?.registro;
    const regs: AliReg[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (regs.length === 0) return [];

    const out: NormalizedPublication[] = [];
    const seen = new Set<string>();
    await mapPool(regs, CONCURRENCY, async (r) => {
      const edicto = r.edicto?.[0];
      const ubi = r.ubicacion?.[0];
      if (!edicto || !ubi || seen.has(edicto)) return;
      seen.add(edicto);
      const text = await fetchPdfText(ubi, { insecure: true });
      if (!text) return;
      const title = (r.extracto?.[0] || `Edicto ${edicto}`).slice(0, 300);
      out.push({
        externalId: `${date.getUTCFullYear()}-${edicto}`,
        title,
        searchText: `${title}\n${text}`.slice(0, MAX_BODY_CHARS),
        url: ubi,
        publishedAt: date,
        actType: inferActType(title),
        region: "Alicante",
      });
    });
    return out;
  },
};
