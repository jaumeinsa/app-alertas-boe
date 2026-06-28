"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animación autoreproducida de "vigilancia en vivo" para el hero.
 * No tiene entrada de usuario: va escaneando con nombres ficticios y muestra
 * cómo se vería un aviso. Todos los nombres y coincidencias son de ejemplo
 * (marcados como tales) — nunca son resultados reales (principio RGPD).
 *
 * Color: azul para el estado normal (escaneo); el coral aparece solo cuando
 * se detecta una coincidencia, como señal de alerta real.
 */

const NAVY = "#22386B";
const CREAM = "#F3EFE4";
const BLUE = "#2C5BD0";
const BLUE_LT = "#9DB6F2";
const CORAL = "#E8552D";
const MONO = "'JetBrains Mono', monospace";
const DISPLAY = "'Bricolage Grotesque', sans-serif";

const SAFE_NAMES = [
  "María García López",
  "Antonio Ruiz Pérez",
  "Lucía Fernández Gil",
  "Javier Moreno Sanz",
  "Carmen Navarro Díaz",
  "David Romero Castro",
  "Elena Vidal Ortega",
  "Sergio Molina Prieto",
];

const SOURCES = [
  "BOE",
  "Tablón Edictal Único",
  "BORME",
  "BOP Madrid",
  "BOP Barcelona",
  "BOP Valencia",
  "BOJA · Andalucía",
  "DOGC · Cataluña",
  "DOG · Galicia",
  "BOCM · Madrid",
  "DOGV · C. Valenciana",
  "BOPV · País Vasco",
  "BOA · Aragón",
  "BORM · Murcia",
];

const ALERTS = [
  { source: "BOE · Tablón Edictal Único", tag: "Embargo", body: "Providencia de apremio de la AEAT por deuda tributaria pendiente." },
  { source: "BOP Madrid", tag: "Multa DGT", body: "Notificación de sanción de tráfico no entregada en domicilio." },
  { source: "BOE · Tablón Edictal Único", tag: "Citación", body: "Citación judicial por edicto del Juzgado de 1ª Instancia." },
  { source: "BORME", tag: "Mercantil", body: "Acto societario que menciona a la persona como administrador." },
];

const TOTAL = 69;

export default function LiveDemo() {
  const [phase, setPhase] = useState<"scanning" | "hit" | "clear">("scanning");
  const [progress, setProgress] = useState(0);
  const [idx, setIdx] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPhase("scanning");
    setProgress(0);

    tickRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= TOTAL) return p;
        return p + 1;
      });
    }, 26);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (holdRef.current) clearTimeout(holdRef.current);
    };
  }, [idx]);

  useEffect(() => {
    if (progress < TOTAL) return;
    if (tickRef.current) clearInterval(tickRef.current);
    // 3 de cada 4 nombres muestran un aviso de ejemplo; el resto sale "limpio".
    const showHit = idx % 4 !== 3;
    setPhase(showHit ? "hit" : "clear");
    holdRef.current = setTimeout(() => {
      setIdx((i) => (i + 1) % SAFE_NAMES.length);
    }, 3000);
  }, [progress, idx]);

  const name = SAFE_NAMES[idx];
  const alert = ALERTS[idx % ALERTS.length];
  const pct = Math.round((Math.min(progress, TOTAL) / TOTAL) * 100);
  const sourceLabel = SOURCES[progress % SOURCES.length];

  return (
    <div
      id="demo"
      style={{
        background: NAVY,
        borderRadius: 26,
        padding: 28,
        color: CREAM,
        boxShadow: "0 30px 70px -28px rgba(34,56,107,.55)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          border: "1px solid rgba(157,182,242,.2)",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".02em", color: "rgba(243,239,228,.55)" }}>
          demo · vigilancia en vivo
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 12, color: BLUE_LT }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: BLUE_LT, animation: "nk-blink 1.4s infinite" }} />
          69 fuentes en línea
        </span>
      </div>

      <div style={{ fontSize: 13, color: "rgba(243,239,228,.6)", marginBottom: 8 }}>Vigilando ahora mismo</div>
      <div
        style={{
          background: "rgba(243,239,228,.07)",
          border: "1px solid rgba(243,239,228,.16)",
          borderRadius: 13,
          padding: "14px 15px",
          fontSize: 18,
          fontFamily: DISPLAY,
          fontWeight: 700,
          letterSpacing: "-.01em",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: BLUE_LT, flexShrink: 0 }} />
        {name}
      </div>

      <div style={{ marginTop: 20, minHeight: 172 }}>
        {phase === "scanning" && (
          <div style={{ border: "1px solid rgba(44,91,208,.4)", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: MONO, fontSize: 12, marginBottom: 12 }}>
              <span style={{ color: BLUE_LT }}>ESCANEANDO…</span>
              <span style={{ color: "rgba(243,239,228,.6)" }}>{Math.min(progress, TOTAL)}/69</span>
            </div>
            <div style={{ height: 6, background: "rgba(243,239,228,.12)", borderRadius: 100, overflow: "hidden", marginBottom: 14 }}>
              <div style={{ height: "100%", background: BLUE, borderRadius: 100, transition: "width .22s ease", width: `${pct}%` }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: CREAM, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: BLUE_LT, animation: "nk-blink .6s infinite" }} />
              {sourceLabel}
            </div>
          </div>
        )}

        {phase === "hit" && (
          <div style={{ border: "1px solid rgba(232,85,45,.45)", background: "rgba(232,85,45,.1)", borderRadius: 16, padding: 20, animation: "nk-rise .35s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: CORAL, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>!</span>
                <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16 }}>Coincidencia detectada</span>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(243,239,228,.5)", border: "1px solid rgba(243,239,228,.2)", borderRadius: 100, padding: "3px 8px" }}>ejemplo</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, fontFamily: MONO, fontSize: 11 }}>
              <span style={{ color: "rgba(243,239,228,.7)", background: "rgba(243,239,228,.08)", borderRadius: 100, padding: "3px 9px" }}>{alert.source}</span>
              <span style={{ color: "#fff", background: CORAL, borderRadius: 100, padding: "3px 9px", fontWeight: 700 }}>{alert.tag}</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "rgba(243,239,228,.85)", lineHeight: 1.5 }}>{alert.body}</p>
            <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 12, color: CORAL }}>→ Te avisaríamos por email y WhatsApp el mismo día</div>
          </div>
        )}

        {phase === "clear" && (
          <div style={{ border: "1px solid rgba(243,239,228,.18)", borderRadius: 16, padding: 20, animation: "nk-rise .35s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(157,182,242,.18)", color: BLUE_LT, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>✓</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16 }}>Hoy, sin novedades</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "rgba(243,239,228,.72)", lineHeight: 1.5 }}>
              Ninguna de las 69 fuentes menciona este nombre hoy. Mañana lo volvemos a comprobar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
