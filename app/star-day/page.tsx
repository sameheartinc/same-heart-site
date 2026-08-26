"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { computeSignal } from "@/lib/starDay";

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
    router.push("/hub");
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
      }}
    >
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
  border: "1px solid #313f5e",
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
