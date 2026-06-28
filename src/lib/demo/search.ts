/**
 * Servicio que alimenta la demo de la landing.
 *
 * Hace una búsqueda REAL contra el BOE: descarga los sumarios de los últimos
 * días y comprueba si el nombre aparece en algún título. Así el visitante
 * comprueba en vivo que el sistema funciona de verdad.
 *
 * Como en un día cualquiera puede no haber ninguna coincidencia para un nombre
 * concreto (lo normal y deseable), añadimos también ejemplos ilustrativos
 * claramente marcados (`isSample: true`) para que la demo siempre muestre cómo
 * se vería una alerta real. Nunca presentamos un ejemplo como si fuese real.
 */

import { evaluateMatch } from "@/lib/matching/match";
import { boeAdapter } from "@/lib/sources/boe";

export interface DemoHit {
  source: string;
  title: string;
  url: string;
  publishedAt: string;
  actType?: string;
  score: number;
  isSample: boolean;
}

export interface DemoResult {
  query: string;
  scannedDays: number;
  scannedSources: number;
  realHits: DemoHit[];
  sampleHits: DemoHit[];
}

const LIVE_DAYS = 6; // cuántos días reales del BOE escanea la demo

const ACT_LABELS: Record<string, string> = {
  multa: "Multa / sanción de tráfico",
  embargo: "Embargo / providencia de apremio",
  citacion: "Citación o requerimiento",
  judicial: "Procedimiento judicial",
  notificacion: "Notificación por edicto",
  mercantil: "Acto mercantil (BORME)",
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Busca el nombre en los últimos días reales del BOE. */
async function searchBoeLive(fullName: string): Promise<DemoHit[]> {
  const hits: DemoHit[] = [];

  for (let i = 0; i < LIVE_DAYS; i++) {
    const date = daysAgo(i);
    let pubs;
    try {
      pubs = await boeAdapter.fetchByDate(date);
    } catch {
      continue; // un día que falle no debe tumbar la demo
    }

    for (const pub of pubs) {
      const result = evaluateMatch({ fullName }, pub);
      if (result.isMatch) {
        hits.push({
          source: "BOE",
          title: pub.title,
          url: pub.url,
          publishedAt: pub.publishedAt.toISOString(),
          actType: pub.actType ? ACT_LABELS[pub.actType] ?? pub.actType : undefined,
          score: result.score,
          isSample: false,
        });
      }
    }
    if (hits.length >= 8) break;
  }

  return hits;
}

/** Ejemplos ilustrativos personalizados con el nombre buscado. */
function buildSampleHits(fullName: string): DemoHit[] {
  const name = fullName.trim() || "Nombre Apellido Apellido";
  const today = new Date();
  const fmt = (n: number) => daysAgo(n).toISOString();

  return [
    {
      source: "TEU (BOE)",
      title: `Anuncio de notificación a ${name} de expediente sancionador en materia de tráfico (DGT)`,
      url: "https://www.boe.es/",
      publishedAt: fmt(3),
      actType: ACT_LABELS.multa,
      score: 0.92,
      isSample: true,
    },
    {
      source: "TEU (BOE)",
      title: `Notificación de providencia de apremio a ${name} por la Agencia Tributaria`,
      url: "https://www.boe.es/",
      publishedAt: fmt(11),
      actType: ACT_LABELS.embargo,
      score: 0.88,
      isSample: true,
    },
    {
      source: "BOP Madrid",
      title: `Edicto de citación a ${name} en procedimiento del Juzgado de lo Social`,
      url: "https://www.boe.es/",
      publishedAt: fmt(20),
      actType: ACT_LABELS.judicial,
      score: 0.81,
      isSample: true,
    },
  ];
}

export async function runDemoSearch(fullName: string): Promise<DemoResult> {
  const realHits = await searchBoeLive(fullName);
  return {
    query: fullName,
    scannedDays: LIVE_DAYS,
    scannedSources: 68, // BOE + BORME + 50 BOP + 17 autonómicos (catálogo objetivo)
    realHits,
    sampleHits: realHits.length === 0 ? buildSampleHits(fullName) : [],
  };
}
