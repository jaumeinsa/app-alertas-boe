"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INK, BLUE, CORAL, WHITE } from "@/lib/theme";

export default function MatchActions({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "confirm" | "dismiss") {
    setBusy(true);
    await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, action }),
    }).catch(() => null);
    router.refresh();
  }

  const btn: React.CSSProperties = {
    border: "1px solid rgba(34,56,107,.25)",
    background: WHITE,
    color: INK,
    borderRadius: 100,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        style={{ ...btn, borderColor: BLUE, color: BLUE }}
        disabled={busy}
        onClick={() => act("confirm")}
      >
        Soy yo
      </button>
      <button
        style={{ ...btn, borderColor: "rgba(232,85,45,.4)", color: CORAL }}
        disabled={busy}
        onClick={() => act("dismiss")}
      >
        No soy yo
      </button>
    </div>
  );
}
