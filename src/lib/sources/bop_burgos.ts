/**
 * Adaptador del BOP de Burgos — code `BOP_09`.
 *
 * Plataforma Drupal (cert TLS con cadena incompleta → insecure). Solo PDF
 * único diario → 1 documento/día:
 *   Fecha→nº: /hemeroteca/YYYY-MM-DD (HTML) → código bopbur-YYYY-NNN.
 *   PDF día:  /sites/default/files/private/publicado/bopbur-YYYY-NNN/bopbur-YYYY-NNN.pdf
 * externalId = bopbur-YYYY-NNN.
 * (TLS legacy: el helper `insecure` baja SECLEVEL para poder conectar.)
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText, fetchText, isoDate } from "./util";

const BASE = "https://bopbur.diputaciondeburgos.es";
const DAY_MAX = 1_000_000;

export const bopBurgosAdapter: SourceAdapter = {
  code: "BOP_09",
  name: "Boletín Oficial de la Provincia de Burgos",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const html = await fetchText(`${BASE}/hemeroteca/${isoDate(date)}`, {
      insecure: true,
    });
    if (!html) return [];
    const m = html.match(/bopbur-(\d{4})-(\d{1,3})/);
    if (!m) return [];
    const num = `${m[1]}-${m[2]}`;
    const url = `${BASE}/sites/default/files/private/publicado/bopbur-${num}/bopbur-${num}.pdf`;
    const text = await fetchPdfText(url, { insecure: true });
    if (!text) return [];
    const title = text.replace(/\s+/g, " ").trim().slice(0, 200) || `bopbur-${num}`;
    return [
      {
        externalId: `bopbur-${num}`,
        title,
        searchText: text.slice(0, DAY_MAX),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Burgos",
      },
    ];
  },
};
