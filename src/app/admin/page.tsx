import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { INK, CREAM, BLUE, BLUE_SOFT, CORAL, WHITE, DISPLAY, MONO, BRAND } from "@/lib/theme";

export const dynamic = "force-dynamic";

const PLAN_LABEL: Record<string, string> = {
  TRIAL: "Prueba",
  MONTHLY: "Personal",
  YEARLY: "Anual",
  FAMILY: "Pack 10",
};

// Ingreso mensualizado estimado por plan (€), para el MRR.
const PLAN_MRR: Record<string, number> = {
  MONTHLY: 1.9, // 1,90 €/mes (IVA incl.)
  YEARLY: 9 / 12, // 9 €/año
  FAMILY: 49 / 12, // pack 10 nombres, 49 €/año
  TRIAL: 0,
};

const STATUS_OK = new Set(["ACTIVE", "TRIALING"]);

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.email)) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: true,
      _count: { select: { profiles: true } },
    },
  });

  const paying = users.filter((u) => u.subscription && STATUS_OK.has(u.subscription.status));
  const mrr = paying.reduce((sum, u) => sum + (PLAN_MRR[u.subscription!.plan] ?? 0), 0);

  const stat = (n: string, l: string) => (
    <div style={{ background: WHITE, border: "1px solid rgba(34,56,107,.1)", borderRadius: 16, padding: "16px 20px" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 28, color: BLUE, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 12.5, color: "rgba(34,56,107,.65)", marginTop: 6 }}>{l}</div>
    </div>
  );

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 11.5,
    fontFamily: MONO,
    textTransform: "uppercase",
    letterSpacing: ".03em",
    color: "rgba(34,56,107,.55)",
    padding: "0 12px 10px",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = { fontSize: 13.5, padding: "11px 12px", borderTop: "1px solid rgba(34,56,107,.08)", verticalAlign: "top" };

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
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK }}>
            <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 18 }}>Notifikado</span>
            <span style={{ background: INK, color: CREAM, fontSize: 11, fontFamily: MONO, padding: "2px 8px", borderRadius: 100 }}>ADMIN</span>
          </Link>
          <div style={{ display: "flex", gap: 16, fontSize: 13.5 }}>
            <Link href="/admin/cobertura" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>Cobertura</Link>
            <Link href="/dashboard" style={{ color: INK, fontWeight: 600, textDecoration: "none" }}>Mi panel</Link>
            <a href="/api/logout" style={{ color: INK, fontWeight: 600, textDecoration: "none" }}>Salir</a>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 22px 64px" }}>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "clamp(1.8rem,4vw,2.4rem)", letterSpacing: "-.03em", margin: "0 0 20px" }}>
          Usuarios y suscripciones
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 28 }}>
          {stat(String(users.length), "Usuarios totales")}
          {stat(String(paying.length), "Suscripciones activas")}
          {stat(`${mrr.toFixed(0)} €`, "Ingreso mensual estimado")}
          {stat(`${(mrr * 12).toFixed(0)} €`, "Anualizado (ARR)")}
        </div>

        <div style={{ background: WHITE, border: "1px solid rgba(34,56,107,.1)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={th}>Email</th>
                  <th style={th}>Plan</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Alta</th>
                  <th style={th}>Pagando desde</th>
                  <th style={th}>Renueva</th>
                  <th style={{ ...th, textAlign: "center" }}>Nombres</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const sub = u.subscription;
                  const ok = sub && STATUS_OK.has(sub.status);
                  const statusColor = ok ? BLUE : sub ? CORAL : "rgba(34,56,107,.5)";
                  const statusText = sub
                    ? { ACTIVE: "activa", TRIALING: "prueba", PAST_DUE: "impago", CANCELED: "cancelada", INCOMPLETE: "incompleta" }[sub.status] ?? sub.status
                    : "sin plan";
                  return (
                    <tr key={u.id}>
                      <td style={td}>
                        <span style={{ fontWeight: 600 }}>{u.email}</span>
                      </td>
                      <td style={td}>{sub ? PLAN_LABEL[sub.plan] ?? sub.plan : "—"}</td>
                      <td style={td}>
                        <span style={{ background: ok ? BLUE_SOFT : "rgba(34,56,107,.06)", color: statusColor, borderRadius: 100, padding: "3px 9px", fontSize: 11.5, fontWeight: 700, fontFamily: MONO }}>
                          {statusText}
                        </span>
                      </td>
                      <td style={td}>{fmtDate(u.createdAt)}</td>
                      <td style={td}>{sub && ok ? fmtDate(sub.createdAt) : "—"}</td>
                      <td style={td}>{sub && ok ? fmtDate(sub.currentPeriodEnd) : "—"}</td>
                      <td style={{ ...td, textAlign: "center" }}>{u._count.profiles}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ marginTop: 16, fontSize: 12.5, color: "rgba(34,56,107,.5)" }}>
          {users.length} usuarios · datos en vivo de la base de datos. El ingreso es una estimación por plan (IVA incluido).
        </p>
      </div>
    </main>
  );
}
