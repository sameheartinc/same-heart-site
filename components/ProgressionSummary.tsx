"use client";

import { useEffect, useState } from "react";
import { fetchProgression, type Progression } from "@/lib/progression";

// A person's progression at a glance -- Level, permanent XP, live
// Momentum, active Boost, streak, and Reputation (see lib/xpEngine.ts).
// Everything shown is derived server-side; this only displays it. XP and
// Level never go down; only Momentum, Boost and streak move with recent
// activity, which is why they're shown as live meters and XP is not.
//
// Shared between /cards and /wallet, so its own frame carries the
// "aviation deck / command centre" language both of those pages already
// use (see app/wallet/page.tsx's own comment on where that came from) --
// clipped panel corners, HUD brackets, amber instrument-panel accents --
// instead of the plain rounded box this used to be. Only the chrome
// changed here; every number and the logic behind it is untouched.
export default function ProgressionSummary() {
  const [p, setP] = useState<Progression | null>(null);

  useEffect(() => {
    fetchProgression().then(setP);
  }, []);

  if (!p) return null;

  const boostDetail = p.boost.parts.map((part) => `${part.label} +${part.percent}%`).join(" · ");

  return (
    <div className="progression-panel" style={{ padding: "18px 20px 20px", maxWidth: "560px", margin: "0 0 26px" }}>
      <p
        style={{
          margin: "0 0 10px",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--gold)",
        }}
      >
        Status &middot; Progression
      </p>

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

      <style jsx>{`
        .progression-panel {
          position: relative;
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
          background: linear-gradient(135deg, rgba(22, 26, 40, 0.88), rgba(9, 11, 18, 0.92));
          border: 1px solid rgba(201, 161, 90, 0.4);
          box-shadow: inset 0 0 0 1px rgba(201, 161, 90, 0.06), 0 0 22px rgba(201, 161, 90, 0.08);
        }
        .progression-panel::before,
        .progression-panel::after {
          content: "";
          position: absolute;
          width: 12px;
          height: 12px;
          border-color: var(--gold);
          border-style: solid;
          pointer-events: none;
        }
        .progression-panel::before {
          top: -1px;
          left: -1px;
          border-width: 2px 0 0 2px;
        }
        .progression-panel::after {
          bottom: -1px;
          right: -1px;
          border-width: 0 2px 2px 0;
        }
      `}</style>
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
