"use client";

/**
 * Página principal: pegar la URL de una carrera → Dorsalia abre el navegador,
 * rellena el formulario con tu perfil y te lo deja listo para revisar y pagar.
 */

import { useEffect, useRef, useState } from "react";

interface FillItem {
  label: string;
  matchedAs: string | null;
  status: "filled" | "consent_pending" | "unmatched" | "skipped" | "error";
}

interface RunResult {
  id: string;
  url: string;
  platform: string;
  status: "running" | "ready_for_review" | "error";
  headless: boolean;
  filled: number;
  consentPending: number;
  unmatched: number;
  items: FillItem[];
  error?: string;
}

interface PlatformEntry {
  id: string;
  name: string;
  website: string;
  scope: string;
  automation: "adapter" | "generic" | "manual";
  notes?: string;
}

const STATUS_ICON: Record<FillItem["status"], string> = {
  filled: "✅",
  consent_pending: "☐",
  unmatched: "❔",
  skipped: "·",
  error: "⚠️",
};

export default function Home() {
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [platforms, setPlatforms] = useState<PlatformEntry[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setProfileReady(Boolean(d.completeness?.ready));
        setMissing(d.completeness?.missing ?? []);
      })
      .catch(() => setProfileReady(false));
    fetch("/api/platforms")
      .then((r) => r.json())
      .then((d) => setPlatforms(d.platforms ?? []))
      .catch(() => {});
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pollRun(runId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/inscripcion?id=${encodeURIComponent(runId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setRun(data.run);
      if (data.run.status !== "running" && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setLaunching(false);
      }
    }, 1500);
  }

  async function launch() {
    setError(null);
    setRun(null);
    setLaunching(true);
    try {
      const res = await fetch("/api/inscripcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error lanzando la inscripción");
        setLaunching(false);
        return;
      }
      pollRun(data.runId);
    } catch {
      setError("No se pudo contactar con el servidor");
      setLaunching(false);
    }
  }

  return (
    <>
      <h1>Inscríbete sin rellenar formularios</h1>
      <p className="lead">
        Pega el enlace de la carrera. Dorsalia abre el formulario, lo rellena con tu
        perfil y te lo deja listo: tú revisas, consientes y pagas.
      </p>

      {profileReady === false && (
        <div className="notice warn">
          Tu perfil aún no está completo
          {missing.length > 0 && <> (falta: {missing.join(", ")})</>}. Ve a{" "}
          <a href="/perfil">Mi perfil</a> y complétalo — con una foto de tu DNI se
          rellena casi solo.
        </div>
      )}

      <div className="card">
        <h2>Nueva inscripción</h2>
        <div className="row">
          <input
            type="url"
            placeholder="https://www.rockthesport.com/es/evento/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: "1 1 320px" }}
          />
          <button onClick={launch} disabled={launching || !url.trim()}>
            {launching ? "Rellenando…" : "Rellenar inscripción"}
          </button>
        </div>
        {error && <div className="notice error">{error}</div>}

        {run && run.status === "running" && (
          <div className="notice">Abriendo la página y rellenando campos…</div>
        )}

        {run && run.status === "error" && (
          <div className="notice error">Algo falló: {run.error}</div>
        )}

        {run && run.status === "ready_for_review" && (
          <>
            <div className="notice ok">
              <strong>{run.filled} campos rellenados</strong> en {run.platform}.{" "}
              {run.headless
                ? "Ejecución sin pantalla: revisa el informe y la captura en data/runs/."
                : "El navegador ha quedado abierto: revisa el formulario, marca los consentimientos y completa el pago tú mismo."}
            </div>
            {run.consentPending > 0 && (
              <div className="notice warn">
                Hay {run.consentPending} casilla(s) de consentimiento sin marcar —
                léelas y márcalas tú (Dorsalia no acepta condiciones por ti).
              </div>
            )}
            <ul className="report">
              {run.items
                .filter((i) => i.status !== "skipped")
                .map((i, idx) => (
                  <li key={idx}>
                    {STATUS_ICON[i.status]} {i.label}
                    {i.matchedAs && <span className="muted"> — {i.matchedAs}</span>}
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>

      <div className="card">
        <h2>Plataformas cubiertas</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          El motor heurístico funciona en cualquier formulario; estas son las
          plataformas objetivo y su nivel de soporte.
        </p>
        <table className="platforms">
          <tbody>
            {platforms.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <span className={`tag ${p.automation}`}>
                    {p.automation === "adapter"
                      ? "adaptador"
                      : p.automation === "generic"
                        ? "heurístico"
                        : "calendario"}
                  </span>
                </td>
                <td className="muted">{p.website}</td>
                <td className="muted">{p.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
