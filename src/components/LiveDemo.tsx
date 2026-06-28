"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Demo autoreproducida de "vigilancia en vivo" para el hero de la landing.
 *
 * No tiene entrada de usuario: cicla por nombres ficticios, escanea las 69
 * fuentes oficiales y muestra el resultado (un aviso de EJEMPLO o "sin
 * novedades"). Comunica de un vistazo la promesa del producto: vigilamos los
 * boletines y te avisamos el mismo día si tu nombre aparece.
 *
 * Diseño claro y ligero: tarjeta BLANCA sobre el beige de la página, con todo
 * el texto en azul marino (INK) y una sombra azul muy suave que la posa sin
 * aplastar el fondo. El azul es el estado normal (escaneo en marcha). El coral
 * aparece SOLO en la alerta, como única señal de aviso — nunca en superficies
 * grandes.
 *
 * RGPD: todos los nombres y coincidencias son de EJEMPLO (marcados como tales);
 * nunca se presentan como resultados reales.
 *
 * SSR/hidratación: nada de Date.now()/Math.random(); todo varía por índice.
 */

const INK = "#22386B"; // azul marino — texto y elementos oscuros
const BLUE = "#2C5BD0"; // azul saturado — acentos, barra, estado
const BLUE_LT = "#9DB6F2"; // azul claro
const BLUE_SOFT = "#E7ECFB"; // superficie azul muy clara
const CORAL = "#E8552D"; // SOLO alerta
const WHITE = "#FFFFFF";

const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
const SANS = "'Instrument Sans', system-ui, -apple-system, sans-serif";
const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";

const INK_82 = "rgba(34,56,107,.82)";
const INK_72 = "rgba(34,56,107,.72)";
const INK_60 = "rgba(34,56,107,.6)";
const INK_45 = "rgba(34,56,107,.45)";

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

type Alert = { source: string; tag: string; body: string };

const ALERTS: Alert[] = [
  {
    source: "BOE · Tablón Edictal Único",
    tag: "Embargo",
    body: "Providencia de apremio de la AEAT por deuda tributaria pendiente.",
  },
  {
    source: "BOP Madrid",
    tag: "Multa DGT",
    body: "Notificación de sanción de tráfico no entregada en domicilio.",
  },
  {
    source: "BOE · Tablón Edictal Único",
    tag: "Citación",
    body: "Citación judicial por edicto del Juzgado de 1ª Instancia.",
  },
  {
    source: "BORME",
    tag: "Mercantil",
    body: "Acto societario que menciona a la persona como administrador.",
  },
];

const TOTAL = 69;

// Altura común de la zona de resultado: evita el salto vertical del hero al
// ciclar entre las tres fases (scanning / hit / clear).
const RESULT_MIN_H = 172;

type Phase = "scanning" | "hit" | "clear";

export default function LiveDemo() {
  const [phase, setPhase] = useState<Phase>("scanning");
  const [progress, setProgress] = useState(0);
  const [idx, setIdx] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Escaneo: progreso 0..69. Variamos por índice (sin Math.random / Date.now)
  // para no romper la hidratación SSR.
  useEffect(() => {
    setPhase("scanning");
    setProgress(0);

    tickRef.current = setInterval(() => {
      setProgress((p) => (p >= TOTAL ? p : p + 1));
    }, 26);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (holdRef.current) clearTimeout(holdRef.current);
    };
  }, [idx]);

  // Al completar el escaneo: 3 de cada 4 muestran aviso de ejemplo; el 4º sale
  // limpio. Mantiene ~3 s el resultado y pasa al siguiente nombre.
  useEffect(() => {
    if (progress < TOTAL) return;
    if (tickRef.current) clearInterval(tickRef.current);
    const showHit = idx % 4 !== 3;
    setPhase(showHit ? "hit" : "clear");
    holdRef.current = setTimeout(() => {
      setIdx((i) => (i + 1) % SAFE_NAMES.length);
    }, 3000);
  }, [progress, idx]);

  const name = SAFE_NAMES[idx];
  const alert = ALERTS[idx % ALERTS.length];
  const scanned = Math.min(progress, TOTAL);
  const pct = Math.round((scanned / TOTAL) * 100);
  // La etiqueta de fuente avanza por tramos del escaneo (no en cada tick), para
  // que el nombre se lea con calma en lugar de parpadear.
  const sourceLabel = SOURCES[Math.floor(scanned / 5) % SOURCES.length];

  const stateColor = phase === "hit" ? CORAL : BLUE;
  const stateLabel =
    phase === "scanning"
      ? "Escaneando"
      : phase === "hit"
      ? "Aviso detectado"
      : "Sin novedades";

  return (
    <div
      id="demo"
      style={{
        background: WHITE,
        borderRadius: 24,
        border: "1px solid rgba(34,56,107,.08)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,.9) inset, 0 22px 50px -28px rgba(44,91,208,.45), 0 6px 18px -12px rgba(34,56,107,.18)",
        overflow: "hidden",
        color: INK,
        fontFamily: SANS,
      }}
    >
      {/* ── Cabecera: marca de la demo + latido en vivo ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 22px",
          borderBottom: "1px solid rgba(34,56,107,.07)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: INK_45,
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: BLUE_SOFT,
              color: BLUE,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <BellIcon size={14} />
          </span>
          Demo en vivo
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontFamily: MONO,
            fontSize: 11,
            color: BLUE,
          }}
        >
          <span style={{ position: "relative", width: 7, height: 7 }}>
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: BLUE,
                animation: "nk-ping 1.8s ease-out infinite",
              }}
            />
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: BLUE,
              }}
            />
          </span>
          69 fuentes en línea
        </span>
      </div>

      <div style={{ padding: "20px 22px 22px" }}>
        {/* ── A quién vigilamos ── */}
        <div style={{ fontSize: 12.5, color: INK_60, marginBottom: 7 }}>
          Vigilando ahora mismo el nombre
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: BLUE_SOFT,
            border: "1px solid rgba(44,91,208,.14)",
            borderRadius: 14,
            padding: "13px 15px",
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: "50%",
              background: WHITE,
              border: "1px solid rgba(44,91,208,.22)",
              color: BLUE,
              display: "grid",
              placeItems: "center",
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {initials(name)}
          </span>
          <span
            style={{
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 19,
              letterSpacing: "-.01em",
              color: INK,
              lineHeight: 1.1,
            }}
          >
            {name}
          </span>
        </div>

        {/* ── Barra de progreso del escaneo (siempre visible, legible) ── */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 9,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: MONO,
                fontSize: 11.5,
                letterSpacing: ".04em",
                textTransform: "uppercase",
                color: stateColor,
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: stateColor,
                  animation:
                    phase === "scanning" ? "nk-blink .7s infinite" : "none",
                }}
              />
              {stateLabel}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: INK_45 }}>
              <span style={{ color: INK, fontWeight: 500 }}>{scanned}</span>
              {" / 69 fuentes"}
            </span>
          </div>

          <div
            style={{
              height: 8,
              background: "#EEF1FA",
              borderRadius: 100,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                height: "100%",
                width: `${pct}%`,
                borderRadius: 100,
                overflow: "hidden",
                background:
                  phase === "hit"
                    ? CORAL
                    : `linear-gradient(90deg, ${BLUE} 0%, ${BLUE_LT} 100%)`,
                transition: "width .22s ease, background .3s ease",
              }}
            >
              {phase === "scanning" && (
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)",
                    animation: "nk-scan 1s linear infinite",
                  }}
                />
              )}
            </div>
          </div>

          {/* Fuente que se está revisando — solo durante el escaneo */}
          <div
            style={{
              marginTop: 10,
              minHeight: 18,
              fontFamily: MONO,
              fontSize: 12,
              color: INK_60,
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: phase === "scanning" ? 1 : 0,
              transition: "opacity .2s ease",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: BLUE_LT,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {"Revisando · "}
              {sourceLabel}
            </span>
          </div>
        </div>

        {/* ── Resultado destacado (altura común: sin salto vertical) ── */}
        <div style={{ marginTop: 16, minHeight: RESULT_MIN_H }}>
          {phase === "scanning" && (
            <div
              style={{
                border: "1px dashed rgba(34,56,107,.16)",
                borderRadius: 16,
                padding: "20px 18px",
                background: "rgba(231,236,251,.4)",
                display: "flex",
                alignItems: "center",
                gap: 13,
                color: INK_60,
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  borderRadius: 11,
                  background: BLUE_SOFT,
                  color: BLUE,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <SearchIcon />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5, color: INK }}>
                  Buscando en los boletines de hoy
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.45 }}>
                  Si tu nombre aparece, el aviso te llega aquí mismo.
                </p>
              </div>
            </div>
          )}

          {phase === "hit" && (
            <div
              style={{
                border: "1px solid rgba(232,85,45,.30)",
                background: "#FFF4F0",
                borderRadius: 16,
                padding: "16px 18px 18px",
                boxShadow: "0 16px 34px -22px rgba(232,85,45,.4)",
                animation: "nk-rise .35s ease both",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  gap: 10,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: CORAL,
                      color: WHITE,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <AlertIcon />
                  </span>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontWeight: 700,
                      fontSize: 16.5,
                      color: INK,
                      letterSpacing: "-.01em",
                    }}
                  >
                    Coincidencia encontrada
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: WHITE,
                    background: CORAL,
                    borderRadius: 100,
                    padding: "3px 9px",
                    flexShrink: 0,
                  }}
                >
                  ejemplo
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 7,
                  marginBottom: 11,
                  fontFamily: MONO,
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    color: INK,
                    background: WHITE,
                    border: "1px solid rgba(34,56,107,.14)",
                    borderRadius: 100,
                    padding: "3px 10px",
                  }}
                >
                  {alert.source}
                </span>
                <span
                  style={{
                    color: CORAL,
                    background: "rgba(232,85,45,.10)",
                    border: "1px solid rgba(232,85,45,.25)",
                    borderRadius: 100,
                    padding: "3px 10px",
                    fontWeight: 700,
                  }}
                >
                  {alert.tag}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: 14, color: INK_82, lineHeight: 1.5 }}>
                {alert.body}
              </p>

              <div
                style={{
                  marginTop: 14,
                  paddingTop: 13,
                  borderTop: "1px solid rgba(232,85,45,.18)",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  fontSize: 12.5,
                  color: INK,
                }}
              >
                <span style={{ color: CORAL, display: "inline-flex", flexShrink: 0 }}>
                  <ArrowIcon />
                </span>
                <span>
                  Te avisaríamos por <strong>email y WhatsApp</strong> el mismo
                  día.
                </span>
              </div>
            </div>
          )}

          {phase === "clear" && (
            <div
              style={{
                border: "1px solid rgba(44,91,208,.18)",
                background: BLUE_SOFT,
                borderRadius: 16,
                padding: "16px 18px 18px",
                animation: "nk-rise .35s ease both",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  marginBottom: 9,
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    borderRadius: "50%",
                    background: BLUE,
                    color: WHITE,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <CheckIcon />
                </span>
                <span
                  style={{
                    fontFamily: DISPLAY,
                    fontWeight: 700,
                    fontSize: 16.5,
                    color: INK,
                    letterSpacing: "-.01em",
                  }}
                >
                  Hoy, sin novedades
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: INK_72, lineHeight: 1.5 }}>
                Ninguna de las 69 fuentes menciona este nombre hoy. Mañana lo
                volvemos a comprobar,{" "}
                <em style={{ fontFamily: SERIF, fontStyle: "italic" }}>
                  sin que tengas que hacer nada
                </em>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Iniciales del nombre (máx. 2) para el avatar del estado. */
function initials(full: string): string {
  const parts = full.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 5a2 2 0 1 1 4 0c4 1 5 4 5 9l1 2H4l1-2c0-5 1-8 5-9" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
