/**
 * Adaptador del BOP de Almería (04) — archivo digital **Pandora** (Cran
 * Consulting) en `app.dipalme.org/pandora`. NO se usa el visor ZK (zkau+JS):
 * Pandora es todo GET stateless (sin cookies ni JS), 1 PDF completo por día
 * (patrón día-PDF como Cádiz/León): 1 NormalizedPublication = el boletín entero.
 *
 * Nodo del BOP en el árbol Pandora:
 *   parent:0000010919  ("Boletín Oficial de la Provincia de Almería")
 *   → ~48.092 ejemplares, desde 28/7/1834 hasta hoy menos ~2 semanas
 *     (Pandora tiene un retraso de ingesta de ~2 semanas; si la fecha objetivo
 *     es más reciente que el último ejemplar disponible → return []).
 *
 * ── POR QUÉ ESTE ADAPTADOR YA NO USA `results.vm` ──────────────────────────
 * La versión anterior localizaba el docId de una fecha con una BÚSQUEDA BINARIA
 * sobre `results.vm?...t=%2Bcreation` (listado ordenado por fecha). Esa consulta
 * ORDENA los ~48.092 ejemplares en el servidor y revienta la memoria del backend
 * Jetty ("java.lang.OutOfMemoryError: GC overhead limit"): 3-5 consultas seguidas
 * lo tumban (500 → 502 → 503) y la binaria dispara 6-10 por día. En un backfill
 * de años, mataba la sede (por eso solo entraban ~167 docs).
 *
 * El PDF en sí (`high.raw`) es BARATO y funciona siempre (servir un fichero
 * estático). Y el docId de Pandora es PERMANENTE por ejemplar y CRECE con la
 * fecha (con rarísimas excepciones de ejemplares reingestados fuera de orden).
 *
 * Estrategia nueva (1-3 GETs/día en vez de 6-10 consultas letales):
 *  1) Caché a nivel de módulo `anchorCache` (fecha AAAAMMDD → docId), sembrada
 *     con 3 anclas verificadas. Persiste entre llamadas a fetchByDate, así que
 *     un backfill de días contiguos reutiliza anclas y va resolviendo casi al
 *     instante (la 2ª/3ª fecha cercana ya interpola sobre docIds vecinos).
 *  2) Para una fecha objetivo, INTERPOLAR el docId candidato entre las anclas
 *     que la rodean y pedir `high.raw` de ese docId directamente; leer la fecha
 *     REAL de la cabecera del PDF y estrechar (búsqueda por interpolación sobre
 *     el espacio de docId). Cada observación (fecha,docId) se añade a la caché.
 *  3) Día sin boletín → el intervalo de docId colapsa a dos ejemplares contiguos
 *     cuyas fechas rodean la objetivo → []. Fecha más reciente que el último
 *     ejemplar (retraso de ingesta) → [].
 *  4) Reintento con backoff ante caídas transitorias / arranque en frío del
 *     backend (lo aporta `util.fetchRetry` más un reintento externo aquí).
 *
 * externalId = "BOP_04-{docId}" (docId Pandora de 10 dígitos con ceros).
 * Anclas verificadas con curl: 14/2/2020=0000389630, 15/3/2023=0000390559,
 * 19/6/2026=0000392690.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import { fetchPdfText, MAX_BODY_CHARS } from "./util";

const PANDORA = "https://app.dipalme.org/pandora";

/** Ceros a la izquierda: el id de Pandora es de 10 dígitos ("0000389630"). */
function pad(docId: number): string {
  return String(docId).padStart(10, "0");
}

/** URL del PDF del boletín completo para un docId. */
function pdfUrl(docId: number): string {
  return (
    `${PANDORA}/high.raw?id=${pad(docId)}` +
    `&name=00000001.original.pdf&attachment=bop.pdf`
  );
}

interface Obs {
  ymd: number; // AAAAMMDD
  docId: number;
}

/**
 * Caché a nivel de módulo fecha→docId. Sembrada con las 3 anclas verificadas y
 * ampliada con cada ejemplar observado. Persiste entre llamadas para acelerar
 * fechas cercanas (backfill de días contiguos).
 */
const anchorCache = new Map<number, number>([
  [20200214, 389630],
  [20230315, 390559],
  [20260619, 392690],
]);

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Convierte AAAAMMDD a nº de día (para interpolar linealmente por fecha). */
function ymdToDays(ymd: number): number {
  const y = Math.floor(ymd / 10000);
  const m = Math.floor((ymd % 10000) / 100);
  const d = ymd % 100;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** AAAAMMDD comparable a partir de año/mes/día. */
function toKey(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}

/**
 * Lee la fecha de publicación de la cabecera del PDF. La portada del BOP de
 * Almería empieza por: "Número: 50Miércoles, 15 de marzo de 2023 Depósito
 * Legal ...". Tomamos la PRIMERA fecha "DD de mes de AAAA" del inicio del texto
 * (la de la cabecera), no una del cuerpo.
 */
function parseYmdFromText(text: string): number | null {
  const head = text.slice(0, 3000);
  const m = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i.exec(head);
  if (!m) return null;
  const mo = MONTHS[m[2].toLowerCase()];
  if (!mo) return null;
  const d = parseInt(m[1], 10);
  const y = parseInt(m[3], 10);
  if (d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return toKey(y, mo, d);
}

/**
 * Descarga el PDF de un docId y devuelve { ymd (fecha real leída), text }.
 * null = no hay PDF utilizable ahí (docId inexistente, no-PDF, o sin fecha
 * legible) o fallo de red persistente. Reintento externo para sobrevivir al
 * arranque en frío del backend (la 1ª petición tras un rato ocioso puede colgar
 * hasta agotar el timeout; la siguiente ya responde).
 */
async function probeDoc(
  docId: number
): Promise<{ ymd: number; text: string } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await fetchPdfText(pdfUrl(docId), { retries: 1 });
    if (text) {
      const ymd = parseYmdFromText(text);
      return ymd ? { ymd, text } : null;
    }
    if (attempt === 0) await sleep(1500);
  }
  return null;
}

/** Pendiente global docId/día a partir de las anclas extremas (para extrapolar). */
function globalSlope(): number {
  let lo: Obs | null = null;
  let hi: Obs | null = null;
  for (const [ymd, docId] of anchorCache) {
    if (!lo || ymd < lo.ymd) lo = { ymd, docId };
    if (!hi || ymd > hi.ymd) hi = { ymd, docId };
  }
  if (!lo || !hi) return 1;
  const dd = ymdToDays(hi.ymd) - ymdToDays(lo.ymd);
  if (dd <= 0) return 1;
  return (hi.docId - lo.docId) / dd;
}

/** Ancla con fecha máxima por debajo / mínima por encima de target. */
function bracketAnchors(target: number): { lo: Obs | null; hi: Obs | null } {
  let lo: Obs | null = null;
  let hi: Obs | null = null;
  for (const [ymd, docId] of anchorCache) {
    if (ymd < target) {
      if (!lo || ymd > lo.ymd) lo = { ymd, docId };
    } else if (ymd > target) {
      if (!hi || ymd < hi.ymd) hi = { ymd, docId };
    }
  }
  return { lo, hi };
}

const MAX_PROBES = 18; // tope de PDFs por fecha (seguridad; casos cálidos: 1-2)
const MAX_ADJ_GAP = 14; // días entre dos ejemplares contiguos "normales"
const NEAR_DAYS = 16; // "cerca" de un dato conocido → vía rápida por barrido local
const SCAN_R = 7; // radio del barrido local alrededor de la estimación

/** Desplazamientos en abanico desde el centro: 0,-1,1,-2,2,... hasta ±r. */
function centerOut(r: number): number[] {
  const out = [0];
  for (let i = 1; i <= r; i++) out.push(-i, i);
  return out;
}

type Resolved =
  | { docId: number; text: string }
  | { none: true } // sin boletín / fecha aún no ingerida
  | { error: true }; // fallo de red persistente

/**
 * Localiza el docId (y ya de paso el texto del PDF) del ejemplar de `target`
 * sin tocar `results.vm`. Devuelve {none} si ese día no hubo boletín o si la
 * fecha es más reciente que el último ejemplar disponible.
 */
type P = { ymd: number; docId: number; text?: string };

async function resolveDocId(target: number): Promise<Resolved> {
  const targetDays = ymdToDays(target);
  let probes = 0;

  async function probe(
    docId: number
  ): Promise<{ ymd: number; docId: number; text: string } | null> {
    if (probes >= MAX_PROBES) return null;
    probes++;
    const p = await probeDoc(docId);
    if (!p) return null;
    anchorCache.set(p.ymd, docId);
    return { ymd: p.ymd, docId, text: p.text };
  }

  // Cache directa: aún así hay que descargar el PDF (el texto no se cachea).
  const cached = anchorCache.get(target);
  if (cached !== undefined) {
    const p = await probe(cached);
    if (p && p.ymd === target) return { docId: cached, text: p.text };
    // Ancla incoherente (rarísimo): seguir con la búsqueda normal.
  }

  const slope = globalSlope();
  const { lo: lo0, hi: hi0 } = bracketAnchors(target);

  // Estimación inicial del docId. Solo se interpola con anclas COHERENTES en
  // docId (lo0.docId < hi0.docId); si alguna es anómala (ejemplar reingestado
  // fuera de orden) se usa la pendiente global desde la ancla más cercana. Así
  // una anomalía cacheada nunca produce un intervalo invertido.
  let est: number;
  if (lo0 && hi0 && lo0.docId < hi0.docId) {
    const lD = ymdToDays(lo0.ymd);
    const hD = ymdToDays(hi0.ymd);
    est = Math.round(
      lo0.docId + ((targetDays - lD) / (hD - lD)) * (hi0.docId - lo0.docId)
    );
  } else if (lo0) {
    est = lo0.docId + Math.round(slope * (targetDays - ymdToDays(lo0.ymd)));
  } else if (hi0) {
    est = hi0.docId + Math.round(slope * (targetDays - ymdToDays(hi0.ymd)));
  } else {
    est = 389630; // no debería ocurrir: siempre hay semillas
  }
  if (est < 1) est = 1;

  // Intervalo de trabajo con observaciones REALES: lo = ejemplar de fecha
  // < target más cercano por fecha; hi = el de fecha > target más cercano.
  const bracket: { lo: P | null; hi: P | null } = { lo: null, hi: null };
  const consider = (p: { ymd: number; docId: number; text: string }) => {
    if (p.ymd < target) {
      if (!bracket.lo || p.ymd > bracket.lo.ymd) bracket.lo = p;
    } else if (p.ymd > target) {
      if (!bracket.hi || p.ymd < bracket.hi.ymd) bracket.hi = p;
    }
  };
  let o: { ymd: number; docId: number; text: string } | null = null;

  // ── VÍA RÁPIDA: barrido local en abanico alrededor de la estimación ──
  // Cuando la fecha está cerca de datos conocidos (backfill de días contiguos o
  // fechas junto a un ancla) el docId objetivo está a ±pocos de `est`. Barrer
  // desde el centro resuelve en 1-3 peticiones y es robusto ante ejemplares
  // reingestados fuera de orden (comparamos por la fecha REAL, no por posición).
  let nearestDist = Infinity;
  for (const ymd of anchorCache.keys()) {
    const dist = Math.abs(targetDays - ymdToDays(ymd));
    if (dist < nearestDist) nearestDist = dist;
  }
  if (nearestDist <= NEAR_DAYS) {
    for (const off of centerOut(SCAN_R)) {
      if (probes >= MAX_PROBES) break;
      const id = est + off;
      if (id < 1) continue;
      const p = await probe(id);
      if (!p) continue;
      if (p.ymd === target) return { docId: p.docId, text: p.text };
      if (!o) o = p;
      consider(p);
      // Dos ejemplares contiguos que rodean la fecha → no seguir barriendo.
      if (bracket.lo && bracket.hi && bracket.hi.docId - bracket.lo.docId === 1) {
        break;
      }
    }
    // Intervalo contiguo limpio → ese día no tuvo boletín.
    if (bracket.lo && bracket.hi && bracket.hi.docId - bracket.lo.docId === 1) {
      const gap = ymdToDays(bracket.hi.ymd) - ymdToDays(bracket.lo.ymd);
      if (gap <= MAX_ADJ_GAP) return { none: true };
    }
  }

  // Si la vía rápida no dejó ninguna observación, sondear la estimación.
  if (!o) {
    for (const off of centerOut(2)) {
      if (probes >= MAX_PROBES) break;
      const id = est + off;
      if (id < 1) continue;
      const p = await probe(id);
      if (p) {
        o = p;
        break;
      }
    }
  }
  if (!o) return { none: true }; // nada legible cerca → tratar como no disponible
  if (o.ymd === target) return { docId: o.docId, text: o.text };

  // Completar el intervalo con `o` y anclas cacheadas COHERENTES en docId; el
  // lado que falte se rellena estirando con saltos (autocorrige por fecha real,
  // así que un ejemplar fuera de orden solo cuesta alguna petición de más).
  consider(o);
  if (!bracket.hi && hi0 && hi0.docId > o.docId) {
    bracket.hi = { ymd: hi0.ymd, docId: hi0.docId };
  }
  if (!bracket.lo && lo0 && lo0.docId < o.docId) {
    bracket.lo = { ymd: lo0.ymd, docId: lo0.docId };
  }

  for (
    let guard = 0;
    guard < 7 && !(bracket.lo && bracket.hi) && probes < MAX_PROBES;
    guard++
  ) {
    if (!bracket.hi) {
      const from = bracket.lo as P; // fecha < target
      const jump = Math.max(
        1,
        Math.round(slope * Math.max(1, targetDays - ymdToDays(from.ymd))) +
          guard * 2
      );
      const p = await probe(from.docId + jump);
      if (!p) return { none: true }; // fin del archivo hacia arriba → aún no ingerido
      if (p.ymd === target) return { docId: p.docId, text: p.text };
      if (p.ymd > target) {
        if (p.docId > from.docId) bracket.hi = p;
      } else if (p.ymd > from.ymd && p.docId > from.docId) {
        bracket.lo = p;
      }
    } else {
      const from = bracket.hi as P; // fecha > target
      const jump = Math.max(
        2,
        Math.round(slope * Math.max(1, ymdToDays(from.ymd) - targetDays)) +
          guard * 3
      );
      const cand = from.docId - jump;
      if (cand < 1) return { none: true };
      const p = await probe(cand);
      if (!p) continue; // hueco/timeout: bajar otro escalón
      if (p.ymd === target) return { docId: p.docId, text: p.text };
      if (p.ymd < target) {
        if (p.docId < from.docId) bracket.lo = p;
      } else if (p.ymd < from.ymd && p.docId < from.docId) {
        bracket.hi = p;
      }
    }
  }

  const lo = bracket.lo;
  const hi = bracket.hi;
  if (!lo || !hi) return { none: true };

  if (lo.docId >= hi.docId) {
    // Cruce anómalo (rarísimo): barrido localizado alrededor de la estimación.
    for (let d = est - 5; d <= est + 5 && probes < MAX_PROBES; d++) {
      if (d < 1) continue;
      const p = await probe(d);
      if (p && p.ymd === target) return { docId: d, text: p.text };
    }
    return { none: true };
  }

  // ── Búsqueda por interpolación en el espacio de docId ──
  let loId = lo.docId;
  let loDate = lo.ymd;
  let hiId = hi.docId;
  let hiDate = hi.ymd;
  let suspicious = false; // ¿algún hueco/anomalía cerca? → justifica barrido final

  while (hiId - loId > 1 && probes < MAX_PROBES) {
    const loD = ymdToDays(loDate);
    const hiD = ymdToDays(hiDate);
    let cand: number;
    if (hiD <= loD) {
      cand = Math.floor((loId + hiId) / 2);
    } else {
      const frac = (targetDays - loD) / (hiD - loD);
      cand = Math.round(loId + frac * (hiId - loId));
    }
    if (cand <= loId) cand = loId + 1;
    if (cand >= hiId) cand = hiId - 1;

    const p = await probe(cand);
    if (!p) {
      // docId sin PDF utilizable: garantizar avance moviendo el borde más cercano.
      if (hiId - cand <= cand - loId) hiId = cand;
      else loId = cand;
      suspicious = true;
      continue;
    }
    if (p.ymd === target) return { docId: cand, text: p.text };
    if (p.ymd < target) {
      loId = cand;
      loDate = p.ymd;
    } else {
      hiId = cand;
      hiDate = p.ymd;
    }
  }

  // Intervalo colapsado. Si las dos fechas contiguas son "normales" (gap chico) y
  // no hubo señales raras → ese día no tuvo boletín. Si hay hueco grande entre
  // docIds contiguos (síntoma de ejemplar reingestado fuera de orden) → barrer.
  if (hiId - loId === 1 && !suspicious) {
    const gap = ymdToDays(hiDate) - ymdToDays(loDate);
    if (gap <= MAX_ADJ_GAP) return { none: true };
  }
  if (hiId - loId === 1 || suspicious) {
    for (let d = loId - 4; d <= hiId + 4 && probes < MAX_PROBES; d++) {
      if (d === loId || d === hiId || d < 1) continue;
      const p = await probe(d);
      if (p && p.ymd === target) return { docId: d, text: p.text };
    }
  }
  return { none: true };
}

export const bopAlmeriaAdapter: SourceAdapter = {
  code: "BOP_04",
  name: "Boletín Oficial de la Provincia de Almería",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const target = toKey(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    );

    const res = await resolveDocId(target);
    if ("none" in res || "error" in res) return [];

    const { docId, text } = res;
    if (!text) return [];

    const url = pdfUrl(docId);
    const title =
      text.replace(/\s+/g, " ").trim().slice(0, 200) ||
      `Boletín Oficial de la Provincia de Almería`;

    return [
      {
        externalId: `BOP_04-${pad(docId)}`,
        title: title.slice(0, 300),
        searchText: text.slice(0, MAX_BODY_CHARS),
        url,
        publishedAt: date,
        actType: inferActType(title),
        region: "Almería",
      },
    ];
  },
};
