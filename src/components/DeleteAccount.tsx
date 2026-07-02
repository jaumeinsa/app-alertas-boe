"use client";

import { useState } from "react";
import { INK, CORAL, WHITE, DISPLAY } from "@/lib/theme";

export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo eliminar la cuenta.");
      window.location.href = data.stripeCancelled === false ? "/?baja=parcial" : "/?baja=ok";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(34,56,107,.55)",
          fontSize: 13,
          textDecoration: "underline",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Eliminar mi cuenta y todos mis datos
      </button>
    );
  }

  return (
    <div
      style={{
        background: "rgba(232,85,45,.06)",
        border: "1px solid rgba(232,85,45,.35)",
        borderRadius: 14,
        padding: "16px 18px",
      }}
    >
      <p style={{ margin: "0 0 10px", fontSize: 13.5, lineHeight: 1.55, color: INK }}>
        Esto <strong>cancela tu suscripción</strong> y <strong>borra de forma irreversible</strong> tus
        nombres vigilados, coincidencias, preferencias y datos de cuenta (art. 17 RGPD). Escribe{" "}
        <strong>ELIMINAR</strong> para confirmar.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.toUpperCase())}
          placeholder="ELIMINAR"
          style={{
            border: "1px solid rgba(232,85,45,.4)",
            borderRadius: 10,
            padding: "9px 12px",
            fontSize: 14,
            fontFamily: "inherit",
            color: INK,
            outline: "none",
            width: 130,
          }}
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={loading || confirm !== "ELIMINAR"}
          style={{
            background: CORAL,
            color: WHITE,
            border: "none",
            borderRadius: 100,
            padding: "9px 18px",
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: loading || confirm !== "ELIMINAR" ? "default" : "pointer",
            opacity: loading || confirm !== "ELIMINAR" ? 0.5 : 1,
          }}
        >
          {loading ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setConfirm(""); setError(null); }}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(34,56,107,.6)",
            fontSize: 13.5,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
      {error && <p style={{ margin: "10px 0 0", color: CORAL, fontSize: 13 }}>{error}</p>}
    </div>
  );
}
