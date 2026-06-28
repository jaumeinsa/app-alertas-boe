import LiveDemo from "@/components/LiveDemo";
import { countCatalog } from "@/lib/sources/catalog";
import Link from "next/link";
import type { CSSProperties } from "react";

/* ── Paleta y tipografías del diseño ────────────────────── */
const INK = "#15140E";
const CREAM = "#F3EFE4";
const TERRA = "#E8552D";
const DISPLAY = "'Bricolage Grotesque', sans-serif";
const SERIF = "'Instrument Serif', serif";
const MONO = "'JetBrains Mono', monospace";
const BRAND = "'Plus Jakarta Sans', sans-serif";

const serifAccent: CSSProperties = { fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 };
const h2Style: CSSProperties = {
  fontFamily: DISPLAY,
  fontWeight: 700,
  fontSize: "clamp(2.2rem,4.4vw,3.6rem)",
  lineHeight: 1.02,
  letterSpacing: "-.03em",
  margin: 0,
};
const kicker: CSSProperties = {
  fontFamily: MONO,
  fontSize: 13,
  letterSpacing: ".04em",
};

/* Destino de los CTA mientras el checkout (Stripe) no está conectado. */
const PRICING = "#precios";

export default function Home() {
  const total = countCatalog().total;

  return (
    <div style={{ background: CREAM, color: INK, overflowX: "hidden" }}>
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <Coverage total={total} />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ── Logo ───────────────────────────────────────────────── */
function Logo({ size = 34, dark = false }: { size?: number; dark?: boolean }) {
  const stroke = dark ? "#FBEDE7" : CREAM;
  const bg = dark ? TERRA : INK;
  const dot = dark ? "#FBEDE7" : TERRA;
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill={bg} />
      <path d="M10 8h8l5 5v13H10z" stroke={stroke} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M18 8v5h5" stroke={stroke} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M13.5 18.5h8M13.5 22.5h5.5" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="24" cy="9.5" r="3.1" fill={dot} stroke={bg} strokeWidth="1.5" />
    </svg>
  );
}

/* ── Nav ────────────────────────────────────────────────── */
function Nav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(243,239,228,.82)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(21,20,14,.08)",
      }}
    >
      <nav
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "16px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link href="#top" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: INK }}>
          <Logo />
          <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 20, letterSpacing: "-.02em" }}>Notifikado</span>
        </Link>
        <div className="nk-navlinks" style={{ display: "flex", alignItems: "center", gap: 30, fontSize: 15, fontWeight: 500 }}>
          <a href="#como-funciona" style={{ textDecoration: "none", color: INK, opacity: 0.72 }}>Cómo funciona</a>
          <a href="#cobertura" style={{ textDecoration: "none", color: INK, opacity: 0.72 }}>Qué vigilamos</a>
          <a href="#precios" style={{ textDecoration: "none", color: INK, opacity: 0.72 }}>Precios</a>
          <a href="#faq" style={{ textDecoration: "none", color: INK, opacity: 0.72 }}>Preguntas</a>
        </div>
        <a
          href={PRICING}
          style={{ textDecoration: "none", background: INK, color: CREAM, fontWeight: 600, fontSize: 15, padding: "11px 20px", borderRadius: 100 }}
        >
          Empezar
        </a>
      </nav>
    </header>
  );
}

/* ── Hero ───────────────────────────────────────────────── */
function Hero() {
  return (
    <section id="top" style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 28px 40px" }}>
      <div className="nk-grid2" style={{ display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 56, alignItems: "center" }}>
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              background: INK,
              color: CREAM,
              padding: "7px 14px 7px 12px",
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: MONO,
              letterSpacing: "-.01em",
            }}
          >
            <span style={{ position: "relative", display: "inline-block", width: 8, height: 8 }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: TERRA }} />
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: TERRA, animation: "nk-ping 1.8s ease-out infinite" }} />
            </span>
            Avisos el mismo día de la publicación
          </div>

          <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "clamp(3rem,6.4vw,5.6rem)", lineHeight: 0.96, letterSpacing: "-.035em", margin: "24px 0 0" }}>
            Que ninguna notificación <span style={serifAccent}>te pille por sorpresa.</span>
          </h1>

          <p style={{ fontSize: 19, lineHeight: 1.55, maxWidth: "36ch", margin: "24px 0 0", color: "rgba(21,20,14,.74)" }}>
            Multas, embargos, citaciones, requerimientos. Cuando la Administración no consigue localizarte, lo publica en un boletín oficial y los plazos corren igual.{" "}
            <strong style={{ color: INK, fontWeight: 600 }}>Vigilamos todas las fuentes y te avisamos en cuanto aparece tu nombre.</strong>
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 26, fontSize: 14, fontWeight: 500 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ color: INK }}>✓</span> Cobertura nacional</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ color: INK }}>✓</span> Sin permanencia</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ color: INK }}>✓</span> Datos con RGPD</span>
          </div>

          <a
            href={PRICING}
            style={{ display: "inline-block", marginTop: 28, textDecoration: "none", background: TERRA, color: INK, fontWeight: 700, fontSize: 16, padding: "15px 28px", borderRadius: 100 }}
          >
            Empezar a vigilar mi nombre →
          </a>
        </div>

        <LiveDemo />
      </div>

      <SourceMarquee />
    </section>
  );
}

function SourceMarquee() {
  const items = ["BOE", "Tablón Edictal Único", "BORME", "50 Boletines Provinciales", "17 Diarios Autonómicos", "BOJA", "DOGC", "DOG", "BOCM", "BOPV", "BOA", "BORM"];
  const loop = [...items, ...items];
  return (
    <div style={{ marginTop: 48, borderTop: "1px solid rgba(21,20,14,.1)", borderBottom: "1px solid rgba(21,20,14,.1)", padding: "18px 0", overflow: "hidden", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, width: "max-content", animation: "nk-marquee 32s linear infinite", fontFamily: MONO, fontSize: 14, fontWeight: 500 }}>
        {loop.map((m, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 14, color: "rgba(21,20,14,.6)" }}>
            {m}
            <span style={{ color: TERRA, fontSize: 18 }}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Problema (oscuro) ──────────────────────────────────── */
function Problem() {
  const problems = [
    { icon: "🚗", title: "Multas que nunca recibiste", body: "Si la DGT no consigue notificarte, publica la sanción por edicto. El plazo para recurrir corre aunque no te enteres, y acaba en embargo." },
    { icon: "🏦", title: "Embargos de Hacienda", body: "Las providencias de apremio se notifican en el Tablón Edictal Único del BOE. Descubrirlo tarde multiplica recargos e intereses." },
    { icon: "⚖️", title: "Citaciones judiciales", body: "Juzgados y administraciones citan por edicto cuando no te encuentran. No comparecer tiene consecuencias serias." },
  ];
  return (
    <section style={{ background: INK, color: CREAM, padding: "96px 28px", marginTop: 40 }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ maxWidth: "46ch" }}>
          <span style={{ ...kicker, color: TERRA }}>{"// EL RIESGO REAL"}</span>
          <h2 style={{ ...h2Style, margin: "16px 0 0" }}>
            Lo que no sabes <span style={serifAccent}>sí</span> te puede hacer daño
          </h2>
          <p style={{ fontSize: 18, color: "rgba(243,239,228,.66)", margin: "20px 0 0", lineHeight: 1.55 }}>
            Desde 2015, cuando la Administración no logra notificarte en persona, lo hace publicándolo en el Tablón Edictal Único. A efectos legales, ya estás notificado.
          </p>
        </div>
        <div className="nk-grid3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginTop: 48 }}>
          {problems.map((p) => (
            <div key={p.title} style={{ background: "rgba(243,239,228,.04)", border: "1px solid rgba(243,239,228,.1)", borderRadius: 20, padding: 28 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: "rgba(232,85,45,.14)", display: "grid", placeItems: "center", fontSize: 24, marginBottom: 20 }}>{p.icon}</div>
              <h3 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 21, letterSpacing: "-.02em", margin: "0 0 10px" }}>{p.title}</h3>
              <p style={{ margin: 0, fontSize: 15, color: "rgba(243,239,228,.62)", lineHeight: 1.55 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Cómo funciona ──────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { n: "1", title: "Registra tu nombre", body: "Indica tu nombre completo y, opcionalmente, los últimos dígitos de tu DNI y tu provincia para afinar y evitar falsas alarmas." },
    { n: "2", title: "Vigilamos cada día", body: "Cada mañana descargamos y analizamos los boletines oficiales recién publicados buscando cualquier mención a ti." },
    { n: "3", title: "Te avisamos al instante", body: "Si apareces, recibes un email (y WhatsApp si lo activas) con el enlace al documento oficial y de qué trata. A tiempo para actuar." },
  ];
  return (
    <section id="como-funciona" style={{ maxWidth: 1240, margin: "0 auto", padding: "96px 28px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 52 }}>
        <div>
          <span style={{ ...kicker, color: "rgba(21,20,14,.5)" }}>{"// CÓMO FUNCIONA"}</span>
          <h2 style={{ ...h2Style, margin: "14px 0 0" }}>Tres pasos. Cero sorpresas.</h2>
        </div>
        <a href={PRICING} style={{ textDecoration: "none", color: INK, fontWeight: 600, borderBottom: `2px solid ${TERRA}`, paddingBottom: 3 }}>Ver planes →</a>
      </div>
      <div className="nk-grid3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
        {steps.map((s) => (
          <div key={s.n} style={{ background: "#fff", border: "1px solid rgba(21,20,14,.09)", borderRadius: 22, padding: 30, position: "relative", overflow: "hidden" }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 64, lineHeight: 1, color: TERRA, WebkitTextStroke: `1.5px ${INK}`, letterSpacing: "-.04em" }}>{s.n}</div>
            <h3 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 21, letterSpacing: "-.02em", margin: "18px 0 10px" }}>{s.title}</h3>
            <p style={{ margin: 0, fontSize: 15, color: "rgba(21,20,14,.66)", lineHeight: 1.55 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Cobertura ──────────────────────────────────────────── */
function Coverage({ total }: { total: number }) {
  const coverage = [
    { k: "BOE y Tablón Edictal Único", v: "multas, embargos, citaciones." },
    { k: "BORME", v: "actos mercantiles, concursos, administradores." },
    { k: "50 Boletines Provinciales", v: "ayuntamientos y diputaciones." },
    { k: "Diarios autonómicos", v: "BOJA, DOGC, DOG, BOCM y más." },
  ];
  const stats = [
    { n: String(total), l: "Fuentes vigiladas" },
    { n: "50", l: "Boletines provinciales" },
    { n: "17", l: "Diarios autonómicos" },
    { n: "24/7", l: "Vigilancia continua" },
    { n: "9€", l: "Al mes" },
    { n: "<24h", l: "Hasta el aviso" },
  ];
  return (
    <section id="cobertura" style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px 96px" }}>
      <div style={{ background: TERRA, borderRadius: 28, padding: "clamp(36px,5vw,64px)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: -80, right: -60, width: 280, height: 280 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(21,20,14,.16)", animation: "nk-radar 3s ease-out infinite" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(21,20,14,.16)", animation: "nk-radar 3s ease-out infinite 1.5s" }} />
        </div>
        <div className="nk-coverage" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 48, alignItems: "center", position: "relative" }}>
          <div>
            <h2 style={{ ...h2Style, fontSize: "clamp(2.2rem,4.4vw,3.4rem)", lineHeight: 1.0 }}>
              Una suscripción. <span style={serifAccent}>{total}</span> fuentes oficiales vigiladas.
            </h2>
            <p style={{ fontSize: 17, color: "rgba(21,20,14,.86)", margin: "18px 0 24px", lineHeight: 1.55, maxWidth: "42ch" }}>
              No tienes que saber en qué boletín puede salir tu nombre. Cubrimos el mapa completo de publicaciones oficiales de España.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11, fontSize: 15 }}>
              {coverage.map((c) => (
                <li key={c.k} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <span style={{ color: INK, fontWeight: 800, fontFamily: MONO }}>→</span>
                  <span><strong>{c.k}</strong> — {c.v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="nk-statgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {stats.map((st) => (
              <div key={st.l} style={{ background: INK, color: CREAM, borderRadius: 18, padding: 22 }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: TERRA }}>{st.n}</div>
                <div style={{ fontSize: 13, color: "rgba(243,239,228,.66)", marginTop: 7, fontWeight: 500 }}>{st.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Precios ────────────────────────────────────────────── */
function Pricing() {
  const plans = [
    {
      name: "Personal", price: "9€", per: "/mes", badge: "Más popular",
      bg: INK, fg: CREAM, border: INK, tick: TERRA,
      btnBg: TERRA, btnFg: INK, btnBorder: TERRA, cta: "Empezar ahora",
      features: ["1 nombre vigilado", "Todas las fuentes oficiales", "Avisos por email", "Escaneo del histórico reciente", "Sin permanencia"],
    },
    {
      name: "Anual", price: "90€", per: "/año", badge: "Ahorra 18€",
      bg: "#fff", fg: INK, border: "rgba(21,20,14,.12)", tick: INK,
      btnBg: INK, btnFg: CREAM, btnBorder: INK, cta: "Pagar el año",
      features: ["Todo lo del plan Personal", "Equivale a 7,50 €/mes", "Avisos por email + WhatsApp"],
    },
    {
      name: "Familiar", price: "15€", per: "/mes", badge: "",
      bg: "#fff", fg: INK, border: "rgba(21,20,14,.12)", tick: INK,
      btnBg: "transparent", btnFg: INK, btnBorder: "rgba(21,20,14,.2)", cta: "Proteger a mi familia",
      features: ["Hasta 5 nombres vigilados", "Ideal para familias y autónomos", "Avisos por email + WhatsApp", "Panel único de control"],
    },
  ];
  return (
    <section id="precios" style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px 96px" }}>
      <div style={{ textAlign: "center", maxWidth: "44ch", margin: "0 auto 52px" }}>
        <span style={{ ...kicker, color: "rgba(21,20,14,.5)" }}>{"// PRECIOS"}</span>
        <h2 style={{ ...h2Style, margin: "14px 0 12px" }}>Cuesta menos que una multa</h2>
        <p style={{ fontSize: 17, color: "rgba(21,20,14,.66)", margin: 0, lineHeight: 1.55 }}>
          Sin prueba gratis: una sola notificación detectada a tiempo ya paga años de suscripción. Cancela cuando quieras.
        </p>
      </div>
      <div className="nk-grid3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, alignItems: "stretch" }}>
        {plans.map((pl) => (
          <div key={pl.name} style={{ borderRadius: 24, padding: 32, display: "flex", flexDirection: "column", border: `1px solid ${pl.border}`, background: pl.bg, color: pl.fg, position: "relative" }}>
            {pl.badge && (
              <span style={{ position: "absolute", top: 22, right: 22, background: TERRA, color: INK, fontSize: 12, fontWeight: 700, fontFamily: MONO, padding: "5px 11px", borderRadius: 100 }}>{pl.badge}</span>
            )}
            <h3 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, letterSpacing: "-.02em", margin: "0 0 14px" }}>{pl.name}</h3>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, letterSpacing: "-.03em" }}>{pl.price}</span>
              <span style={{ fontSize: 15, opacity: 0.6 }}>{pl.per}</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 28px", display: "flex", flexDirection: "column", gap: 12, fontSize: 15, flex: 1 }}>
              {pl.features.map((f) => (
                <li key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: pl.tick, fontWeight: 800 }}>✓</span>
                  <span style={{ opacity: 0.85 }}>{f}</span>
                </li>
              ))}
            </ul>
            <a href="#empezar" style={{ textDecoration: "none", textAlign: "center", borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 15, background: pl.btnBg, color: pl.btnFg, border: `1px solid ${pl.btnBorder}` }}>{pl.cta}</a>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── FAQ ────────────────────────────────────────────────── */
function Faq() {
  const faqs = [
    { q: "¿Es legal vigilar los boletines oficiales?", a: "Sí. El BOE y el resto de boletines son publicaciones públicas y de acceso libre. Notifikado solo busca tu propio nombre por ti y te avisa, usando datos abiertos oficiales." },
    { q: "¿Qué pasa con mis datos personales?", a: "Solo usamos tu nombre (y opcionalmente los últimos dígitos de tu DNI y tu provincia) para vigilar en tu nombre. Tratamos los datos conforme al RGPD y nunca los vendemos ni compartimos." },
    { q: "¿Cómo evitáis los falsos positivos si mi nombre es común?", a: "Puedes afinar la vigilancia con los últimos dígitos de tu DNI y tu provincia. Nuestro motor da más confianza a las coincidencias que casan también esos datos, reduciendo el ruido." },
    { q: "¿Con qué rapidez me avisáis?", a: "Analizamos los boletines el mismo día de su publicación. En cuanto detectamos una coincidencia, recibes el aviso con el enlace al documento oficial." },
    { q: "¿Puedo cancelar cuando quiera?", a: "Sí, sin permanencia ni penalización. Cancelas desde tu panel en cualquier momento." },
  ];
  return (
    <section id="faq" style={{ maxWidth: 880, margin: "0 auto", padding: "0 28px 96px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <span style={{ ...kicker, color: "rgba(21,20,14,.5)" }}>{"// PREGUNTAS FRECUENTES"}</span>
        <h2 style={{ ...h2Style, fontSize: "clamp(2.2rem,4.4vw,3.4rem)", margin: "14px 0 0" }}>Lo que la gente nos pregunta</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {faqs.map((f) => (
          <details key={f.q} style={{ background: "#fff", border: "1px solid rgba(21,20,14,.09)", borderRadius: 16, overflow: "hidden" }}>
            <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "22px 24px" }}>
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, letterSpacing: "-.01em", color: INK }}>{f.q}</span>
              <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: "rgba(21,20,14,.06)", color: INK, display: "grid", placeItems: "center", fontSize: 18, fontWeight: 600 }}>+</span>
            </summary>
            <p style={{ margin: 0, padding: "0 24px 24px", fontSize: 16, color: "rgba(21,20,14,.68)", lineHeight: 1.6, maxWidth: "62ch" }}>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ── CTA final ──────────────────────────────────────────── */
function FinalCta() {
  return (
    <section id="empezar" style={{ background: INK, color: CREAM, padding: "96px 28px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", textAlign: "center", position: "relative" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 26 }}>
          <Logo size={40} dark />
        </div>
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "clamp(2.6rem,5.6vw,4.8rem)", lineHeight: 0.98, letterSpacing: "-.035em", margin: "0 auto", maxWidth: "18ch" }}>
          Empieza a dormir tranquilo <span style={serifAccent}>hoy.</span>
        </h2>
        <p style={{ fontSize: 18, color: "rgba(243,239,228,.66)", margin: "22px auto 32px", maxWidth: "46ch", lineHeight: 1.55 }}>
          Activa la vigilancia y te avisamos en cuanto tu nombre aparezca en cualquier boletín oficial. Desde 9 €/mes, sin permanencia.
        </p>
        <a href={PRICING} style={{ textDecoration: "none", display: "inline-block", background: TERRA, color: INK, fontWeight: 700, fontSize: 17, padding: "16px 32px", borderRadius: 100 }}>
          Empezar ahora →
        </a>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ background: INK, color: CREAM, borderTop: "1px solid rgba(243,239,228,.1)", padding: "40px 28px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Logo size={30} />
          <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 17 }}>Notifikado</span>
        </div>
        <span style={{ fontSize: 13, color: "rgba(243,239,228,.5)", fontFamily: MONO }}>© 2026 · Vigilancia de boletines oficiales · RGPD</span>
        <div style={{ display: "flex", gap: 20, fontSize: 14 }}>
          <a href="#" style={{ color: "rgba(243,239,228,.6)", textDecoration: "none" }}>Privacidad</a>
          <a href="#" style={{ color: "rgba(243,239,228,.6)", textDecoration: "none" }}>Términos</a>
        </div>
      </div>
    </footer>
  );
}
