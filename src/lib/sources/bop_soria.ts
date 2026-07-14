/**
 * Adaptador del BOP de Soria (42) — plataforma Pixelware `bop.dipsoria.es`.
 *
 * Cadena de 3 GET (sin cookies/JS; el certificado TLS está roto → insecure:true).
 * OJO: todas las rutas mem.* necesitan el prefijo de módulo /index.php/mod.boloficial
 * (sin él dan 404). Pipeline de fetchByDate(date):
 *
 *  1) GET /index.php/mod.boloficial/mem.listadodia/fecha.DD-MM-YYYY
 *     - Si NO trae un enlace mem.detalle/id.NNNNN/relcategoria.210 → ese día no
 *       hubo boletín (Soria publica L-X-V; jueves/festivos → "No se ha encontrado
 *       ningún boletín") → return [].
 *     - relcategoria.210 es el contenedor real del boletín del día; las otras
 *       relcategoria.1183/1229/... del listado son categorías temáticas FIJAS
 *       (iguales todos los días) y NO se usan. El `id` es único y creciente por día.
 *
 *  2) GET /index.php/mod.boloficial/mem.detalle/id.NNNNN/relcategoria.210
 *     - Lista los PDFs del día. El PRIMER enlace
 *       mod.documentos/mem.descargar/fichero.documentos_NN_HASH%232E%23pdf es el
 *       BOLETÍN COMPLETO del día (los siguientes son anuncios individuales).
 *     - El sufijo %232E%23 en la URL es '#2E#' url-encoded = '.pdf' (dejar tal cual).
 *
 *  3) GET ese enlace de descarga → application/pdf con capa de texto perfecta.
 *
 * Soria es un caso "boletín PDF completo/día": el boletín entero es 1 documento
 * (searchText = texto del PDF completo). externalId = code + id del boletín.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { ddmmyyyy, fetchPdfText, fetchText, MAX_BODY_CHARS } from "./util";

const BASE = "https://bop.dipsoria.es/index.php/mod.boloficial";
const OPTS = { insecure: true as const }; // cert TLS roto (Apache 2.2, OpenSSL viejo)

export const bopSoriaAdapter: SourceAdapter = {
  code: "BOP_42",
  name: "Boletín Oficial de la Provincia de Soria",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const f = ddmmyyyy(date); // DD-MM-YYYY
    const listado = await fetchText(
      `${BASE}/mem.listadodia/fecha.${f}`,
      OPTS
    );
    if (!listado) return [];

    // Enlace al detalle del boletín del día (contenedor real = relcategoria.210).
    const detM = /mem\.detalle\/id\.(\d+)\/relcategoria\.210/.exec(listado);
    if (!detM) return []; // día sin boletín (finde/festivo) → [] sin error
    const bulletinId = detM[1];

    const detalle = await fetchText(
      `${BASE}/mem.detalle/id.${bulletinId}/relcategoria.210`,
      OPTS
    );
    if (!detalle) return [];

    // El PRIMER enlace de descarga es el boletín completo del día.
    const dlM =
      /mod\.documentos\/mem\.descargar\/fichero\.(documentos_\d+_[0-9a-f]+%232E%23pdf)/i.exec(
        detalle
      );
    if (!dlM) return []; // sin PDF descargable → nada que ingerir
    const pdfUrl = `${BASE.replace(
      "/mod.boloficial",
      ""
    )}/mod.documentos/mem.descargar/fichero.${dlM[1]}`;

    const text = await fetchPdfText(pdfUrl, OPTS);
    if (!text) return []; // error de red del PDF → no tumbar el día

    const title =
      text.replace(/\s+/g, " ").trim().slice(0, 200) ||
      `Boletín Oficial de la Provincia de Soria ${f}`;

    return [
      {
        externalId: `BOP_42-${bulletinId}`,
        title: title.slice(0, 300),
        searchText: text.slice(0, MAX_BODY_CHARS),
        url: pdfUrl,
        publishedAt: date,
        actType: inferActType(title),
        region: "Soria",
      },
    ];
  },
};
