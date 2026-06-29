import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import MatchActions from "@/components/MatchActions";
import RescanButton from "@/components/RescanButton";
import {
  INK,
  CREAM,
  BLUE,
  BLUE_SOFT,
  CORAL,
  WHITE,
  DISPLAY,
  MONO,
  BRAND,
  actTypeColor,
  actTypeLabel,
} from "@/lib/theme";

export const dynamic = "force-dynamic";

function Logo() {
  return (
    <svg width={30} height={30} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill={INK} />
      <path d="M10 8h8l5 5v13H10z" stroke={CREAM} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M18 8v5h5" stroke={CREAM} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M13.5 18.5h8M13.5 22.5h5.5" stroke={CREAM} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="24" cy="9.5" r="3.1" fill={CORAL} stroke={INK} strokeWidth="1.5" />
    </svg>
  );
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profiles = await prisma.monitoredProfile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const matches = await prisma.match.findMany({
    where: { profile: { userId: user.id }, status: { not: "DISMISSED" } },
    include: { publication: { include: { source: true } }, profile: true },
    orderBy: { publication: { publishedAt: "desc" } },
    take: 200,
  });

  const confirmed = matches.filter((m) => m.status === "CONFIRMED").length;

  return (
    <main style={{ background: CREAM, minHeight: "100vh", color: INK }}>
      {/* Cabecera */}
      <header
        style={{
          background: "rgba(243,239,228,.85)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(34,56,107,.1)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            padding: "14px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK }}>
            <Logo />
            <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 18 }}>Notifikado</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13.5 }}>
            <span style={{ color: "rgba(34,56,107,.6)" }}>{user.email}</span>
            <a href="/api/logout" style={{ color: INK, fontWeight: 600, textDecoration: "none" }}>
              Salir
            </a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 22px 64px" }}>
        {/* Resumen */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 26 }}>
          <div>
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "clamp(1.8rem,4vw,2.6rem)", letterSpacing: "-.03em", margin: "0 0 6px" }}>
              Tu vigilancia
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: "rgba(34,56,107,.7)" }}>
              Vigilando{" "}
              {profiles.map((p, i) => (
                <span key={p.id}>
                  <strong style={{ color: INK }}>{p.fullName}</strong>
                  {i < profiles.length - 1 ? ", " : ""}
                </span>
              ))}{" "}
              en 69 fuentes oficiales.
            </p>
          </div>
          <RescanButton />
        </div>

        {/* Tarjetas de stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { n: matches.length, l: "Coincidencias" },
            { n: confirmed, l: "Confirmadas por ti" },
            { n: profiles.length, l: "Nombres vigilados" },
          ].map((s) => (
            <div key={s.l} style={{ background: WHITE, border: "1px solid rgba(34,56,107,.1)", borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, color: BLUE, lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: 13, color: "rgba(34,56,107,.65)", marginTop: 6 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Lista de coincidencias */}
        {matches.length === 0 ? (
          <div
            style={{
              background: WHITE,
              border: "1px dashed rgba(34,56,107,.2)",
              borderRadius: 18,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 10 }}>🛡️</div>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, margin: "0 0 8px" }}>
              De momento, sin coincidencias
            </h2>
            <p style={{ margin: "0 auto", maxWidth: "46ch", fontSize: 14.5, color: "rgba(34,56,107,.7)", lineHeight: 1.55 }}>
              Estamos cargando el histórico de los boletines. Te avisaremos en cuanto tu nombre aparezca. Puedes pulsar &quot;Buscar ahora&quot; para revisar lo ya indexado.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {matches.map((m) => (
              <div
                key={m.id}
                style={{
                  background: WHITE,
                  border: "1px solid rgba(34,56,107,.1)",
                  borderRadius: 16,
                  padding: "18px 20px",
                  borderLeft: `4px solid ${actTypeColor(m.publication.actType)}`,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 9, fontFamily: MONO, fontSize: 11 }}>
                  <span style={{ background: BLUE_SOFT, color: BLUE, borderRadius: 100, padding: "3px 10px", fontWeight: 700 }}>
                    {actTypeLabel(m.publication.actType)}
                  </span>
                  <span style={{ color: "rgba(34,56,107,.6)" }}>{m.publication.source.code}</span>
                  <span style={{ color: "rgba(34,56,107,.6)" }}>· {fmtDate(m.publication.publishedAt)}</span>
                  {m.status === "CONFIRMED" && (
                    <span style={{ color: BLUE, fontWeight: 700 }}>· confirmada</span>
                  )}
                  <span style={{ marginLeft: "auto", color: "rgba(34,56,107,.5)" }}>
                    {Math.round(m.score * 100)}% coincidencia
                  </span>
                </div>

                <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.5, color: INK }}>
                  {m.publication.title}
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <a
                    href={m.publication.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13.5, fontWeight: 600, color: BLUE, textDecoration: "none" }}
                  >
                    Ver documento oficial →
                  </a>
                  {m.status !== "CONFIRMED" && <MatchActions matchId={m.id} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
