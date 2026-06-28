"use client";

import { useState } from "react";

interface DemoHit {
  source: string;
  title: string;
  url: string;
  publishedAt: string;
  actType?: string;
  score: number;
  isSample: boolean;
}

interface DemoResult {
  query: string;
  scannedDays: number;
  scannedSources: number;
  realHits: DemoHit[];
  sampleHits: DemoHit[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function HitCard({ hit }: { hit: DemoHit }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
          {hit.source}
        </span>
        {hit.actType && (
          <span className="rounded-full bg-alert-500/10 px-2 py-0.5 font-semibold text-alert-600">
            {hit.actType}
          </span>
        )}
        <span className="text-slate-400">{formatDate(hit.publishedAt)}</span>
        <span className="ml-auto font-medium text-slate-500">
          {Math.round(hit.score * 100)}% coincidencia
        </span>
      </div>
      <p className="text-sm leading-snug text-slate-800">{hit.title}</p>
    </li>
  );
}

export default function DemoSearch() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (name.trim().length < 3) {
      setError("Escribe tu nombre y apellidos.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error en la búsqueda");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre y apellidos (ej. Antonio García López)"
          className="w-full flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          aria-label="Nombre y apellidos"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Buscando…" : "Buscar gratis"}
        </button>
      </form>

      <p className="mt-2 text-xs text-slate-400">
        Búsqueda real en el BOE de los últimos días. No guardamos lo que escribes
        en la demo.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5">
          <p className="mb-3 text-sm text-slate-600">
            Escaneados <strong>{result.scannedDays} días</strong> del BOE ·
            objetivo de cobertura: <strong>{result.scannedSources} fuentes</strong>{" "}
            oficiales.
          </p>

          {result.realHits.length > 0 ? (
            <>
              <p className="mb-2 text-sm font-semibold text-slate-800">
                Coincidencias reales encontradas ({result.realHits.length}):
              </p>
              <ul className="flex flex-col gap-3">
                {result.realHits.map((hit, i) => (
                  <HitCard key={i} hit={hit} />
                ))}
              </ul>
            </>
          ) : (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              ✅ Buenas noticias: <strong>{result.query}</strong> no aparece en el
              BOE de los últimos días. Así de tranquilo estarías cada día con
              Notifikado vigilando por ti.
            </div>
          )}

          {result.sampleHits.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Ejemplo: así se vería una alerta real
              </p>
              <ul className="flex flex-col gap-3 opacity-90">
                {result.sampleHits.map((hit, i) => (
                  <HitCard key={i} hit={hit} />
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">
                Estos ejemplos son ilustrativos, no resultados reales.
              </p>
            </div>
          )}

          <a
            href="#precios"
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Activar vigilancia diaria — 9 €/mes
          </a>
        </div>
      )}
    </div>
  );
}
