import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { INK, CREAM, BLUE, BLUE_SOFT, CORAL, WHITE, DISPLAY, MONO, BRAND } from "@/lib/theme";

export const dynamic = "force-dynamic";

// Años objetivo de cobertura (2020 → año en curso).
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

const TYPE_LABEL: Record<string, string> = {
  BOE: "Estatal",
  TEU: "Estatal",
  BORME: "Estatal",
  AUTONOMIC: "Diarios autonómicos",
  BOP: "Boletines provinciales",
};

// Orden de los grupos en la página.
const TYPE_ORDER = ["Estatal", "Diarios autonómicos", "Boletines provinciales"];

interface Row {
  code: string;
  name: string;
  type: string;
  year: number | null;
  n: number;
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
}

// Color de una celda de año según su densidad relativa a la mediana de la
// fuente: así se ven los huecos sin importar el volumen absoluto de cada fuente.
function cellStyle(n: number, median: number): React.CSSProperties {
  if (n === 0) return { background: "rgba(34,56,107,.05)", color: "rgba(34,56,107,.35)" }; // vacío
  const ratio = median > 0 ? n / median : 1;
  if (ratio < 0.3) return { background: "rgba(232,85,45,.16)", color: CORAL, fontWeight: 700 }; // hueco
  if (ratio < 0.7) return { background: "rgba(245,180,40,.20)", color: "#a8730a", fontWeight: 600 }; // parcial
  return { background: BLUE_SOFT, color: BLUE }; // ok
}

function median(nums: number[]): number {
  const xs = nums.filter((x) => x > 0).sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export default async function CoberturaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.email)) redirect("/dashboard");

  // Matriz fuente × año en una sola consulta.
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT s.code, s.name, s.type::text AS type,
           EXTRACT(YEAR FROM p."publishedAt")::int AS year,
           count(p.id)::int AS n
    FROM "Source" s
    LEFT JOIN "Publication" p ON p."sourceId" = s.id
    WHERE s."ingestEnabled" = true
    GROUP BY s.code, s.name, s.type, year
  `;

  // Agrupar por fuente.
  interface Fuente {
    code: string;
    name: string;
    group: string;
    byYear: Map<number, number>;
    total: number;
  }
  const fuentes = new Map<string, Fuente>();
  for (const r of rows) {
    let f = fuentes.get(r.code);
    if (!f) {
      f = { code: r.code, name: r.name, group: TYPE_LABEL[r.type] ?? "Otros", byYear: new Map(), total: 0 };
      fuentes.set(r.code, f);
    }
    if (r.year != null && r.n > 0) {
      f.byYear.set(r.year, (f.byYear.get(r.year) ?? 0) + r.n);
      f.total += r.n;
    }
  }

  const all = [...fuentes.values()];
  const grandTotal = all.reduce((s, f) => s + f.total, 0);
  const fullCoverage = all.filter((f) => YEARS.every((y) => (f.byYear.get(y) ?? 0) > 0)).length;
  const withGaps = all.filter((f) => f.total > 0 && !YEARS.every((y) => (f.byYear.get(y) ?? 0) > 0)).length;
  const empty = all.filter((f) => f.total === 0).length;

  // Rango global de fechas.
  const globalMinMax = await prisma.$queryRaw<{ mn: Date | null; mx: Date | null }[]>`
    SELECT min(p."publishedAt") AS mn, max(p."publishedAt") AS mx FROM "Publication" p
  `;
  const gmin = globalMinMax[0]?.mn ?? null;
  const gmax = globalMinMax[0]?.mx ?? null;

  const grouped = TYPE_ORDER.map((g) => ({
    group: g,
    items: all.filter((f) => f.group === g).sort((a, b) => b.total - a.total),
  })).filter((g) => g.items.length > 0);

  const stat = (n: string, l: string, color = BLUE) => (
    <div style={{ background: WHITE, border: "1px solid rgba(34,56,107,.1)", borderRadius: 16, padding: "16px 20px" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, color, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 12.5, color: "rgba(34,56,107,.65)", marginTop: 6 }}>{l}</div>
    </div>
  );

  const th: React.CSSProperties = {
    fontSize: 11,
    fontFamily: MONO,
    color: "rgba(34,56,107,.55)",
    padding: "0 6px 8px",
    textAlign: "center",
    whiteSpace: "nowrap",
  };
  const yearCell: React.CSSProperties = {
    textAlign: "center",
    fontSize: 12,
    fontFamily: MONO,
    padding: "6px 4px",
    borderRadius: 6,
    minWidth: 44,
  };

  return (
    <main style={{ background: CREAM, minHeight: "100vh", color: INK }}>
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
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK }}>
            <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 18 }}>Notifikado</span>
            <span style={{ background: INK, color: CREAM, fontSize: 11, fontFamily: MONO, padding: "2px 8px", borderRadius: 100 }}>COBERTURA</span>
          </Link>
          <div style={{ display: "flex", gap: 16, fontSize: 13.5 }}>
            <Link href="/admin" style={{ color: INK, fontWeight: 600, textDecoration: "none" }}>Usuarios</Link>
            <Link href="/dashboard" style={{ color: INK, fontWeight: 600, textDecoration: "none" }}>Mi panel</Link>
            <a href="/api/logout" style={{ color: INK, fontWeight: 600, textDecoration: "none" }}>Salir</a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 22px 64px" }}>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "clamp(1.8rem,4vw,2.4rem)", letterSpacing: "-.03em", margin: "0 0 6px" }}>
          Cobertura de la base de datos
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "rgba(34,56,107,.7)" }}>
          {all.length} fuentes vigiladas · rango {fmtDate(gmin)} → {fmtDate(gmax)} · datos en vivo
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
          {stat(fmt(grandTotal), "Documentos totales")}
          {stat(String(fullCoverage), "Fuentes completas 2020→hoy")}
          {stat(String(withGaps), "Con huecos históricos", withGaps ? "#a8730a" : BLUE)}
          {stat(String(empty), "Vacías", empty ? CORAL : BLUE)}
        </div>

        {/* Leyenda */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, marginBottom: 16, color: "rgba(34,56,107,.7)" }}>
          <span><span style={{ display: "inline-block", width: 12, height: 12, background: BLUE_SOFT, borderRadius: 3, verticalAlign: "middle", marginRight: 5 }} />Cobertura buena</span>
          <span><span style={{ display: "inline-block", width: 12, height: 12, background: "rgba(245,180,40,.35)", borderRadius: 3, verticalAlign: "middle", marginRight: 5 }} />Parcial</span>
          <span><span style={{ display: "inline-block", width: 12, height: 12, background: "rgba(232,85,45,.25)", borderRadius: 3, verticalAlign: "middle", marginRight: 5 }} />Hueco</span>
          <span><span style={{ display: "inline-block", width: 12, height: 12, background: "rgba(34,56,107,.08)", borderRadius: 3, verticalAlign: "middle", marginRight: 5 }} />Sin datos</span>
        </div>

        {grouped.map((g) => (
          <section key={g.group} style={{ marginBottom: 30 }}>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, margin: "0 0 10px", color: INK }}>
              {g.group} <span style={{ color: "rgba(34,56,107,.5)", fontWeight: 400, fontSize: 14 }}>· {g.items.length}</span>
            </h2>
            <div style={{ background: WHITE, border: "1px solid rgba(34,56,107,.1)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left", padding: "10px 14px 8px" }}>Fuente</th>
                      {YEARS.map((y) => (
                        <th key={y} style={th}>{y}</th>
                      ))}
                      <th style={{ ...th, textAlign: "right" }}>Total</th>
                      <th style={{ ...th, textAlign: "right", paddingRight: 14 }}>Rango</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((f) => {
                      const med = median(YEARS.map((y) => f.byYear.get(y) ?? 0));
                      const years = [...f.byYear.keys()].sort((a, b) => a - b);
                      const rango = years.length ? `${years[0]}–${years[years.length - 1]}` : "—";
                      const complete = YEARS.every((y) => (f.byYear.get(y) ?? 0) > 0);
                      return (
                        <tr key={f.code} style={{ borderTop: "1px solid rgba(34,56,107,.07)" }}>
                          <td style={{ padding: "8px 14px", fontSize: 13, verticalAlign: "middle" }}>
                            <span style={{ fontWeight: 600 }}>{f.name}</span>
                            <span style={{ color: "rgba(34,56,107,.45)", fontFamily: MONO, fontSize: 11, marginLeft: 8 }}>{f.code}</span>
                          </td>
                          {YEARS.map((y) => {
                            const n = f.byYear.get(y) ?? 0;
                            return (
                              <td key={y} style={{ padding: "3px 4px" }}>
                                <div style={{ ...yearCell, ...cellStyle(n, med) }}>{n === 0 ? "·" : fmt(n)}</div>
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "right", fontFamily: MONO, fontSize: 12.5, fontWeight: 700, padding: "6px 8px", color: f.total ? INK : "rgba(34,56,107,.35)" }}>
                            {f.total ? fmt(f.total) : "0"}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: MONO, fontSize: 11.5, padding: "6px 14px 6px 8px", color: complete ? BLUE : "rgba(34,56,107,.6)", whiteSpace: "nowrap" }}>
                            {complete ? "✓ completo" : rango}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}

        <p style={{ fontSize: 12, color: "rgba(34,56,107,.5)", marginTop: 8 }}>
          El color compara cada año con la mediana de esa fuente, para que un hueco se vea igual en una fuente grande (BOE) que en una pequeña (boletín de 1 doc/día). Los backfills en curso hacen que estos números suban en tiempo real.
        </p>
      </div>
    </main>
  );
}
