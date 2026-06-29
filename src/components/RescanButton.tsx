"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BLUE, WHITE, DISPLAY } from "@/lib/theme";

export default function RescanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function rescan() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/rescan", { method: "POST" });
      const data = await res.json();
      setMsg(
        data.found > 0
          ? `${data.found} coincidencia(s) nueva(s)`
          : "Sin novedades por ahora"
      );
      router.refresh();
    } catch {
      setMsg("No se pudo buscar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={rescan}
        disabled={busy}
        style={{
          background: BLUE,
          color: WHITE,
          border: "none",
          borderRadius: 100,
          padding: "10px 20px",
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 14,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Buscando…" : "Buscar ahora"}
      </button>
      {msg && <span style={{ fontSize: 13, color: "rgba(34,56,107,.7)" }}>{msg}</span>}
    </div>
  );
}
