"use client";

import { useState } from "react";
import { INK, BLUE, BLUE_SOFT, CORAL, WHITE, DISPLAY } from "@/lib/theme";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 100,
        border: "none",
        background: checked ? BLUE : "rgba(34,56,107,.2)",
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        transition: "background .15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: WHITE,
          transition: "left .15s",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
        }}
      />
    </button>
  );
}

export default function NotifyPrefs({
  email,
  initialNotifyEmail,
  initialNotifyWhatsapp,
  initialPhone,
}: {
  email: string;
  initialNotifyEmail: boolean;
  initialNotifyWhatsapp: boolean;
  initialPhone: string | null;
}) {
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(initialNotifyWhatsapp);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyEmail, notifyWhatsapp, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "13px 0",
  };

  return (
    <div style={{ background: WHITE, border: "1px solid rgba(34,56,107,.1)", borderRadius: 16, padding: "20px 22px" }}>
      <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, letterSpacing: "-.01em", margin: "0 0 4px", color: INK }}>
        Cómo te avisamos
      </h2>
      <p style={{ margin: "0 0 8px", fontSize: 13.5, color: "rgba(34,56,107,.65)", lineHeight: 1.5 }}>
        Cuando tu nombre aparezca en un boletín, te avisamos por estos canales.
      </p>

      <div style={{ ...row, borderTop: "1px solid rgba(34,56,107,.08)" }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>Email</div>
          <div style={{ fontSize: 12.5, color: "rgba(34,56,107,.6)" }}>{email}</div>
        </div>
        <Toggle checked={notifyEmail} onChange={setNotifyEmail} />
      </div>

      <div style={{ ...row, borderTop: "1px solid rgba(34,56,107,.08)", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px" }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>
            WhatsApp{" "}
            <span
              style={{
                background: BLUE_SOFT,
                color: BLUE,
                fontSize: 10.5,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 100,
                verticalAlign: "middle",
              }}
            >
              PRÓXIMAMENTE
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(34,56,107,.6)" }}>
            Deja tu número y lo activamos en cuanto esté disponible.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 600 000 000"
            autoComplete="tel"
            style={{
              width: 160,
              border: "1px solid rgba(34,56,107,.22)",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 14,
              fontFamily: "inherit",
              color: INK,
              outline: "none",
            }}
          />
          <Toggle checked={notifyWhatsapp} onChange={setNotifyWhatsapp} />
        </div>
      </div>

      {error && (
        <p style={{ margin: "10px 0 0", color: CORAL, fontSize: 13 }}>{error}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            background: BLUE,
            color: WHITE,
            border: "none",
            borderRadius: 100,
            padding: "10px 22px",
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 14,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar preferencias"}
        </button>
        {saved && <span style={{ color: BLUE, fontSize: 13.5, fontWeight: 600 }}>✓ Guardado</span>}
      </div>
    </div>
  );
}
