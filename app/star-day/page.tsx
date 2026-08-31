"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { computeSignal } from "@/lib/starDay";
import { playTransmitSound, TRANSMIT_DURATION_MS } from "@/lib/transmit";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function StarDayPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transmitting, setTransmitting] = useState(false);

  // Gatekeeping: must be signed in; if Star Day is already set, skip straight to the Hub.
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("birth_date")
        .eq("id", userData.user.id)
        .single();

      if (profile?.birth_date) {
        router.replace("/hub");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (!m || !d || !y || y < 1900 || y > new Date().getFullYear()) {
      setError("That doesn't look like a complete date yet.");
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/login");
      return;
    }

    const signal = computeSignal(m, d, y);
    const birthDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        birth_date: birthDate,
        frequency: signal.frequency,
        archetype: signal.archetype.name,
        designation: signal.designation,
      })
      .eq("id", userData.user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // The transmit moment: a burst of static settling into a locked
    // signal, both audibly and visually, before handing off to the Hub.
    playTransmitSound();
    setTransmitting(true);
    setTimeout(() => router.push("/hub"), TRANSMIT_DURATION_MS);
  }

  if (checking) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--void)",
        padding: "24px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes transmitRing {
          from { transform: scale(0.4); opacity: 0.9; }
          to   { transform: scale(2.6); opacity: 0; }
        }
        @keyframes transmitFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .transmit-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 90px;
          height: 90px;
          margin: -45px 0 0 -45px;
          border-radius: 50%;
          border: 1px solid var(--gold);
          animation: transmitRing 1.1s ease-out both;
        }
        .transmit-overlay {
          animation: transmitFadeIn 0.25s ease both;
        }
        @media (prefers-reduced-motion: reduce) {
          .transmit-ring { animation: none; opacity: 0; }
          .transmit-overlay { animation: none; }
        }
      `}</style>

      {transmitting && (
        <div
          className="transmit-overlay"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--void)",
            zIndex: 10,
          }}
        >
          <div className="transmit-ring" style={{ animationDelay: "0s" }} />
          <div className="transmit-ring" style={{ animationDelay: "0.22s" }} />
          <div className="transmit-ring" style={{ animationDelay: "0.44s" }} />
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "var(--gold)",
              boxShadow: "0 0 18px 4px var(--gold)",
            }}
          />
          <p
            style={{
              marginTop: "26px",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--gold)",
            }}
          >
            Signal locked
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: "420px", width: "100%" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.6rem", marginBottom: "8px" }}>
          When did you arrive?
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            marginBottom: "26px",
          }}
        >
          Every signal has a moment it started. This finds yours -- once, permanently.
        </p>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "22px", flexWrap: "wrap" }}>
          <select value={month} onChange={(e) => setMonth(e.target.value)} required style={selectStyle}>
            <option value="" disabled>Month</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={day} onChange={(e) => setDay(e.target.value)} required style={selectStyle}>
            <option value="" disabled>Day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            style={{ ...selectStyle, width: "100px" }}
          />
        </div>

        {error && <p style={{ color: "#c9576a", fontSize: "0.85rem", marginBottom: "16px" }}>{error}</p>}

        <button type="submit" disabled={saving} style={buttonStyle}>
          {saving ? "Tuning in…" : "Tune in"}
        </button>
      </form>
    </main>
  );
}

const selectStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.95rem",
  background: "var(--panel)",
  color: "var(--ink)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "11px 12px",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--gold)",
  border: "none",
  borderRadius: "999px",
  padding: "12px 26px",
  color: "var(--void)",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  cursor: "pointer",
};
