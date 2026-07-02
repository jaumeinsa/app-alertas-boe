"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  INK,
  BLUE,
  BLUE_SOFT,
  CORAL,
  WHITE,
  DISPLAY,
} from "@/lib/theme";

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: INK,
  marginBottom: 6,
};
const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(34,56,107,.22)",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  fontFamily: "inherit",
  color: INK,
  outline: "none",
  background: WHITE,
};

export default function AltaForm({
  consentText,
  initialEmail,
}: {
  consentText: string;
  initialEmail?: string | null;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [phone, setPhone] = useState("");
  const [provincia, setProvincia] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/alta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          idNumber,
          email,
          phone: phone || undefined,
          provinces: provincia ? [provincia] : [],
          consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo completar el alta.");
      router.push(data.redirect ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={label}>Nombre completo a vigilar</label>
        <input
          style={input}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ej. Jaume Insa García"
          autoComplete="name"
          required
        />
      </div>

      <div>
        <label style={label}>DNI, NIE o CIF</label>
        <input
          style={{ ...input, textTransform: "uppercase" }}
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder="21693936Z"
          required
        />
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(34,56,107,.6)" }}>
          Nos ayuda a confirmar que una coincidencia es realmente tuya y evitar falsas alarmas.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={label}>Email (para los avisos)</label>
          <input
            style={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label style={label}>
            Teléfono <span style={{ fontWeight: 400, color: "rgba(34,56,107,.55)" }}>(opcional · WhatsApp)</span>
          </label>
          <input
            style={input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 600 000 000"
            autoComplete="tel"
          />
        </div>
      </div>

      <div>
        <label style={label}>
          Provincia <span style={{ fontWeight: 400, color: "rgba(34,56,107,.55)" }}>(opcional)</span>
        </label>
        <input
          style={input}
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          placeholder="Valencia"
        />
      </div>

      <label
        style={{
          display: "flex",
          gap: 11,
          alignItems: "flex-start",
          background: BLUE_SOFT,
          border: "1px solid rgba(44,91,208,.18)",
          borderRadius: 12,
          padding: "14px 15px",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: 3, width: 17, height: 17, accentColor: BLUE, flexShrink: 0 }}
          required
        />
        <span style={{ fontSize: 13, lineHeight: 1.5, color: INK }}>
          {consentText} Al activar la vigilancia acepto también las{" "}
          <a href="/terminos" target="_blank" style={{ color: BLUE, fontWeight: 600 }}>
            Condiciones del servicio
          </a>{" "}
          y la{" "}
          <a href="/privacidad" target="_blank" style={{ color: BLUE, fontWeight: 600 }}>
            Política de privacidad
          </a>
          .
        </span>
      </label>

      {error && (
        <p
          style={{
            margin: 0,
            background: "rgba(232,85,45,.1)",
            border: "1px solid rgba(232,85,45,.3)",
            color: CORAL,
            borderRadius: 10,
            padding: "10px 13px",
            fontSize: 13.5,
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: 4,
          background: BLUE,
          color: WHITE,
          border: "none",
          borderRadius: 100,
          padding: "14px 24px",
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 16,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Activando tu vigilancia…" : "Activar mi vigilancia"}
      </button>
    </form>
  );
}
