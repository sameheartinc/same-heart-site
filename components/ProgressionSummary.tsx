"use client";

import { useEffect, useState } from "react";
import { fetchProgression, type Progression } from "@/lib/progression";

// A person's progression at a glance -- Level, permanent XP, live
// Momentum, active Boost, streak, and Reputation (see lib/xpEngine.ts).
// Everything shown is derived server-side; this only displays it. XP and
// Level never go down; only Momentum, Boost and streak move with recent
// activity, which is why they're shown as live meters and XP is not.
export default function ProgressionSummary() {
  const [p, setP] = useState<Progression | null>(null);

  useEffect(() => {
    fetchProgression().then(setP);
  }, []);

  if (!p) return null;

  const boostDetail = p.boost.parts.map((part) => `${part.label} +${part.percent}%`).join(" · ");

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "14px",
        background: "var(--panel)",
        padding: "16px 18px",
        maxWidth: "560px",
        margin: "0 0 26px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem" }}>Level {p.level}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink-dim)" }}>
          {p.xp.toLocaleString()} XP
          {p.nextLevelXp !== null && ` · ${(p.nextLevelXp - p.xp).toLocaleString()} to Level ${p.level + 1}`}
        </span>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
          <span style={labelStyle}>Momentum</span>
          <span style={{ ...labelStyle, color: "var(--gold)" }}>{p.momentum}%</span>
        </div>
        <div style={{ height: "6px", borderRadius: "999px", background: "var(--border)", overflow: "hidden" }}>
          <div
            style={{
              width: `${p.momentum}%`,
              height: "100%",
              background: "var(--gold)",
              transition: "width 0.6s ease",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px" }}>
        <Stat
          label="Active boost"
          value={p.boost.total > 0 ? `+${p.boost.total}%` : "None yet"}
          title={boostDetail || "Take part in the Commons and Exchange to build Momentum."}
        />
        <Stat label="Streak" value={p.streak > 0 ? `${p.streak} day${p.streak === 1 ? "" : "s"}` : "—"} />
        <Stat
          label="Reputation"
          value={String(p.reputation)}
          title="How much other people have found your contributions worthwhile. Separate from XP."
        />
        <Stat label="Standing" value={p.standing} />
      </div>
    </div>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-faint, #5c6684)",
};
