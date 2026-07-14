/**
 * Adaptador del BOP de Málaga (29) — sede `www.bopmalaga.es`.
 *
 * Sumario del día por GET (HTML crudo, sin JS/cookies/Turnstile):
 *   GET https://www.bopmalaga.es/index.php?fecha=DD-MM-YYYY
 *   El HTML ya lista TODOS los edictos del día. Cada uno va en un <article>:
 *     <h3>ORGANISMO</h3>
 *     <p class="vista_edicto">…preview…
 *        <a href="edicto.php?edicto={ID}" ...>Ver edicto NNNN/AAAA</a>
 *        <a href="/verificacion.php?archivo={ID}.pdf" ...>Descargar PDF</a></p>
 *     <p class="vista_sumario"><b>…</b> título resumido</p>
 *   ID = FECHA-NUMERO-AÑO-NN (p.ej. 20260625-02477-2026-01). Cada edicto
 *   aparece 2 veces (enlace edicto.php + enlace PDF): deduplicar por ID.
 *
 * Texto completo de cada anuncio (capa de texto limpia, mejor que el PDF):
 *   GET https://www.bopmalaga.es/edicto.php?edicto={ID}
 *   con cabecera OBLIGATORIA `Referer: https://www.bopmalaga.es/` (sin ella → 404).
 *   Devuelve un HTML grande que es la conversión del PDF con capa de texto.
 *   El PDF original (verificacion.php) SÍ está tras Turnstile, pero NO hace
 *   falta: el texto legible ya está en edicto.php.
 *
 * externalId = ID del edicto (ya único y estable). 1 documento por anuncio.
 * Días sin boletín (finde/festivo) → sin edictos → []. Encoding UTF-8.
 */

import {
  inferActType,
  NormalizedPublication,
  SourceAdapter,
} from "./types";
import {
  ddmmyyyy,
  fetchText,
  MAX_BODY_CHARS,
  mapPool,
  stripHtml,
} from "./util";

const BASE = "https://www.bopmalaga.es";
// La sede exige Referer del propio dominio para servir edicto.php (si no, 404).
const REFERER = { Referer: `${BASE}/` };

// --- Limitador de ritmo (gate) de toda la sede de Málaga --------------------
// La sede corta el tráfico por RITMO, no por volumen total: medido, ~40
// peticiones a ~2,5 req/s (o CONCURRENCY=5) agotan su cubo, dejan de responder
// y cuelgan las conexiones ~45s; a ~1,4 req/s (700ms entre inicios) aguanta
// 50+ sin fallo. Serializamos TODAS las peticiones de la sede (índice y cada
// edicto) a través de este gate de MÓDULO, con un intervalo mínimo entre
// inicios, para que el ritmo se respete también al encadenar día tras día en
// el backfill (no solo dentro de un mismo día). Concurrencia efectiva = 1.
const MIN_GAP_MS = 700;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let gateTail: Promise<unknown> = Promise.resolve();
let lastStart = 0;

/**
 * Encola `fn` detrás de la última petición y espera a que hayan pasado al menos
 * MIN_GAP_MS desde el inicio de la anterior antes de lanzarla. Serializa (solo
 * una petición en vuelo) y limita el ritmo de forma persistente entre llamadas
 * a fetchByDate, que es lo que evita el throttle al cruzar de un día a otro.
 */
function gate<T>(fn: () => Promise<T>): Promise<T> {
  const result = gateTail.then(async () => {
    const wait = Math.max(0, lastStart + MIN_GAP_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    return fn();
  });
  // La cola avanza aunque `fn` rechace, para no bloquear el gate para siempre.
  gateTail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

interface MalagaEdicto {
  id: string; // 20260625-02477-2026-01
  organismo: string; // <h3> de la sección
  ref: string; // "2477/2026" (referencia oficial del edicto)
  preview: string; // texto del <p class="vista_edicto"> (sin el enlace)
  sumario: string; // <p class="vista_sumario"> (título resumido)
}

/** Extrae los edictos del sumario HTML del día. */
function parseSumario(html: string): MalagaEdicto[] {
  const out: MalagaEdicto[] = [];
  const seen = new Set<string>();
  // Troceamos por cada <article>…</article>; el <h3> anterior es el organismo.
  const articleRe = /<article>([\s\S]*?)<\/article>/g;
  let m: RegExpExecArray | null;
  while ((m = articleRe.exec(html))) {
    const block = m[1];
    // ID del edicto (del enlace edicto.php). Cada anuncio lleva uno.
    const idM = /edicto\.php\?edicto=([0-9-]+)/.exec(block);
    if (!idM) continue;
    const id = idM[1];
    if (seen.has(id)) continue;
    seen.add(id);

    // Organismo: el <h3> más cercano ANTES de este <article>.
    const before = html.slice(0, m.index);
    const h3All = [...before.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)];
    const organismo = h3All.length
      ? stripHtml(h3All[h3All.length - 1][1])
      : "";

    // Referencia oficial "NNNN/AAAA": del title/texto del enlace ("Ver edicto 2477/2026").
    const ref = (/(\d{1,7}\s*\/\s*\d{4})/.exec(block)?.[1] ?? "").replace(
      /\s+/g,
      ""
    );

    // Preview: el <p class="vista_edicto"> sin la parte del enlace (span_enlaces).
    const pvM = /<p class="vista_edicto">([\s\S]*?)<span class="span_enlaces">/.exec(
      block
    );
    const preview = pvM ? stripHtml(pvM[1]) : "";

    // Título resumido: <p class="vista_sumario">…</p>.
    const sumM = /<p class="vista_sumario">([\s\S]*?)<\/p>/.exec(block);
    const sumario = sumM ? stripHtml(sumM[1]) : "";

    out.push({ id, organismo, ref, preview, sumario });
  }
  return out;
}

/** Construye un título legible a partir del organismo + sumario. */
function buildTitle(e: MalagaEdicto): string {
  const parts = [e.organismo, e.sumario].filter((s) => s && s.length > 0);
  const base = parts.join(" — ") || e.preview || `BOP Málaga ${e.ref || e.id}`;
  return base.slice(0, 300);
}

export const bopMalagaAdapter: SourceAdapter = {
  code: "BOP_29",
  name: "Boletín Oficial de la Provincia de Málaga",
  type: "BOP",
  enabled: true,

  async fetchByDate(date: Date): Promise<NormalizedPublication[]> {
    const f = ddmmyyyy(date); // DD-MM-YYYY
    // Índice del día a través del gate: cuenta para el ritmo global de la sede.
    const html = await gate(() => fetchText(`${BASE}/index.php?fecha=${f}`));
    // La sede throttlea peticiones seguidas: cuando lo hace, el índice del día
    // NO llega (fetchText null tras reintentos). Un día SIN boletín sí devuelve
    // HTML (con 0 edictos). Distinguirlos evita el falso "día vacío" que en un
    // backfill masivo daría un falso "completo" (le pasó: 42 docs en vez de ~40k).
    // Ante null lanzamos para que la ingesta lo registre como fallo y el backfill
    // reintente el rango a menor ritmo, en vez de darlo por vacío.
    if (html == null) {
      throw new Error("BOP Málaga: índice del día no disponible (throttle/red)");
    }

    const edictos = parseSumario(html);
    if (edictos.length === 0) return [];

    const out: NormalizedPublication[] = edictos.map((e) => {
      const title = buildTitle(e);
      // searchText inicial = organismo + preview + sumario (por si el detalle falla).
      const initial = [e.organismo, e.sumario, e.preview]
        .filter(Boolean)
        .join("\n");
      return {
        externalId: `BOP_29-${e.id}`,
        title,
        searchText: initial.slice(0, MAX_BODY_CHARS),
        url: `${BASE}/edicto.php?edicto=${e.id}`,
        publishedAt: date,
        actType: inferActType(title),
        region: "Málaga",
      };
    });

    // Texto completo de cada edicto (HTML con capa de texto; Referer obligatorio).
    // Un fallo de red de un anuncio no debe tumbar el día: mantiene el inicial.
    // Concurrencia 1 + gate: cada edicto pasa por el limitador de ritmo de la
    // sede. NO usamos el CONCURRENCY global de util aquí: martillear el detalle
    // en paralelo es justo lo que dispara el throttle y cuelga el backfill.
    await mapPool(out, 1, async (pub, i) => {
      try {
        const detail = await gate(() =>
          fetchText(`${BASE}/edicto.php?edicto=${edictos[i].id}`, {
            headers: REFERER,
          })
        );
        if (detail) {
          const text = stripHtml(detail);
          if (text.length > 60) {
            pub.searchText = `${edictos[i].organismo}\n${text}`.slice(
              0,
              MAX_BODY_CHARS
            );
          }
        }
      } catch {
        // se conserva el searchText inicial del sumario
      }
    });

    return out;
  },
};
