"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { INK, CREAM, BLUE, CORAL, WHITE, DISPLAY, BRAND } from "@/lib/theme";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aviso de enlace caducado (redirección desde /api/auth/verify).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "expirado") {
      setError("Ese enlace de acceso ya se usó o ha caducado. Pide uno nuevo aquí.");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar el enlace.");
      setSent(true);
      setDevLink(data.devLink ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ background: CREAM, minHeight: "100vh", color: INK }}>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "48px 22px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK }}>
          <svg width={30} height={30} viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <rect width="34" height="34" rx="9" fill={INK} />
            <path d="M10 8h8l5 5v13H10z" stroke={CREAM} strokeWidth="1.9" strokeLinejoin="round" />
            <path d="M18 8v5h5" stroke={CREAM} strokeWidth="1.9" strokeLinejoin="round" />
            <path d="M13.5 18.5h8M13.5 22.5h5.5" stroke={CREAM} strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="24" cy="9.5" r="3.1" fill={CORAL} stroke={INK} strokeWidth="1.5" />
          </svg>
          <span style={{ fontFamily: BRAND, fontWeight: 800, fontSize: 19 }}>Notifikado</span>
        </Link>

        <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: "2.2rem", letterSpacing: "-.03em", margin: "28px 0 8px" }}>
          Entrar
        </h1>

        <div
          style={{
            background: WHITE,
            border: "1px solid rgba(34,56,107,.1)",
            borderRadius: 18,
            padding: "26px 24px",
            marginTop: 18,
            boxShadow: "0 18px 44px -30px rgba(44,91,208,.5)",
          }}
        >
          {sent ? (
            <div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>
                Te hemos enviado un enlace de acceso a <strong>{email}</strong>. Revisa tu correo.
              </p>
              {devLink && (
                <p style={{ marginTop: 14, fontSize: 13, color: "rgba(34,56,107,.7)" }}>
                  (Email aún no configurado) Enlace directo:{" "}
                  <a href={devLink} style={{ color: BLUE, fontWeight: 600, wordBreak: "break-all" }}>
                    entrar
                  </a>
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(34,56,107,.7)", lineHeight: 1.5 }}>
                Te enviamos un enlace de acceso al correo. Sin contraseñas.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                required
                style={{
                  width: "100%",
                  border: "1px solid rgba(34,56,107,.22)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 15,
                  fontFamily: "inherit",
                  color: INK,
                  outline: "none",
                }}
              />
              {error && (
                <p style={{ margin: 0, color: CORAL, fontSize: 13.5 }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: BLUE,
                  color: WHITE,
                  border: "none",
                  borderRadius: 100,
                  padding: "13px 22px",
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Enviando…" : "Enviarme el enlace"}
              </button>
            </form>
          )}
        </div>

        <p style={{ marginTop: 18, fontSize: 13.5, color: "rgba(34,56,107,.6)", textAlign: "center" }}>
          ¿Aún no vigilas tu nombre?{" "}
          <Link href="/alta" style={{ color: INK, fontWeight: 600 }}>
            Activar vigilancia
          </Link>
        </p>
      </div>
    </main>
  );
}
