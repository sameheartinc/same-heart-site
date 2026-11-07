"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import WorldField from "@/components/WorldField";
import { ONBOARDING_WORLD } from "@/lib/worlds";
import {
  FOCUS_AREAS,
  FREQUENCY_LABELS,
  ROLE_LABELS,
  fetchMyIntake,
  submitIntake,
  type IntakeFrequency,
  type IntakeRole,
  type PeerSupportIntake,
} from "@/lib/peerSupport";

// Peer Support -- the real first step of the system Same Heart is
// actually built around (see lib/peerSupport.ts and
// supabase/schema_peer_support.sql): someone says what they're going
// through, whether they want support or want to give it, and how often
// they'd want to check in. Nothing here matches two people together or
// runs a check-in yet -- this is honestly just intake, saved for real,
// waiting for the next build pass.
//
// Reached from its own bubble on the Galaxy map (see lib/galaxyNodes.ts)
// -- same WorldField backdrop and command-panel frame as Cards/Wallet,
// so it reads as part of the same place rather than a bolted-on form.
export default function PeerSupportPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [existing, setExisting] = useState<PeerSupportIntake | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);

  const [role, setRole] = useState<IntakeRole>("seeking");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<IntakeFrequency>("weekly");
  const [context, setContext] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const intake = await fetchMyIntake();
      if (intake) {
        setExisting(intake);
        setRole(intake.role);
        setFocusAreas(intake.focusAreas);
        setFrequency(intake.frequency);
        setContext(intake.context ?? "");
        setNotes(intake.notes ?? "");
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) return <PageLoading />;

  const locked = existing !== null && existing.status !== "pending";

  function toggleFocusArea(id: string) {
    setFocusAreas((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || saving) return;
    setSaving(true);
    setSavedJustNow(false);
    const result = await submitIntake({ role, focusAreas, frequency, context, notes });
    setSaving(false);
    if (result) {
      setExisting(result);
      setSavedJustNow(true);
    }
  }

  return (
    <main style={{ position: "relative", minHeight: "100vh", color: "var(--ink)", overflow: "hidden" }}>
      <WorldField world={ONBOARDING_WORLD} />

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(201,161,90,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(201,161,90,0.05) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <style jsx>{`
        .command-panel {
          position: relative;
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
          background: linear-gradient(135deg, rgba(22, 26, 40, 0.88), rgba(9, 11, 18, 0.92));
          border: 1px solid rgba(201, 161, 90, 0.4);
          box-shadow: inset 0 0 0 1px rgba(201, 161, 90, 0.06), 0 0 22px rgba(201, 161, 90, 0.08);
        }
        .command-panel::before,
        .command-panel::after {
          content: "";
          position: absolute;
          width: 12px;
          height: 12px;
          border-color: var(--gold);
          border-style: solid;
          pointer-events: none;
        }
        .command-panel::before {
          top: -1px;
          left: -1px;
          border-width: 2px 0 0 2px;
        }
        .command-panel::after {
          bottom: -1px;
          right: -1px;
          border-width: 0 2px 2px 0;
        }
        .focus-chip {
          cursor: pointer;
          user-select: none;
        }
        textarea,
        select {
          font-family: var(--font-body);
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "640px", margin: "0 auto", padding: "48px 22px 90px" }}>
        <Link
          href="/galaxy"
          style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.82rem", textDecoration: "none" }}
        >
          &larr; Back to the Galaxy
        </Link>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--gold)",
            margin: "22px 0 8px",
          }}
        >
          Intake &middot; Step one
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.6rem", margin: "0 0 4px" }}>
          Peer Support
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            fontSize: "0.9rem",
            color: "var(--ink-dim)",
            margin: "0 0 24px",
            maxWidth: "52ch",
          }}
        >
          This is the start of Same Heart&rsquo;s peer support system -- intake first, then
          matching, then ongoing check-ins. Matching isn&rsquo;t built yet, so nothing happens
          automatically the moment you submit, but what you share here is saved and real.
        </p>

        <div
          className="command-panel"
          style={{
            padding: "16px 18px",
            marginBottom: "28px",
            fontFamily: "var(--font-body)",
            fontSize: "0.86rem",
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          Same Heart is not a crisis service, and no one is monitoring this form in real
          time. If you or someone else is in immediate danger, call{" "}
          <a href="tel:911" style={{ color: "var(--gold)", fontWeight: 700 }}>
            911
          </a>{" "}
          first. For a full list of real crisis helplines you can reach right now, visit{" "}
          <Link href="/support" style={{ color: "var(--gold)", fontWeight: 700 }}>
            Support Services
          </Link>
          .
        </div>

        {locked && (
          <div className="command-panel" style={{ padding: "16px 18px", marginBottom: "24px" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "rgba(255,255,255,0.78)" }}>
              Your intake is marked <strong style={{ color: "var(--gold)" }}>{existing?.status}</strong>. It&rsquo;s
              no longer editable here -- reach out through{" "}
              <Link href="/contact" style={{ color: "var(--gold)" }}>
                Contact
              </Link>{" "}
              if something needs to change.
            </p>
          </div>
        )}

        {savedJustNow && !locked && (
          <div className="command-panel" style={{ padding: "16px 18px", marginBottom: "24px" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "0.9rem", color: "rgba(255,255,255,0.78)" }}>
              Saved. Your intake is marked <strong style={{ color: "var(--gold)" }}>pending</strong> -- you can
              come back and change any of this any time before it&rsquo;s matched.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="command-panel" style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: "26px" }}>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={sectionLabelStyle}>What are you looking for?</legend>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
              {(Object.keys(ROLE_LABELS) as IntakeRole[]).map((r) => (
                <label key={r} style={radioLabelStyle(role === r)}>
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    disabled={locked}
                    onChange={() => setRole(r)}
                    style={{ accentColor: "var(--gold)" }}
                  />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={sectionLabelStyle}>What&rsquo;s this around? (pick any that fit)</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
              {FOCUS_AREAS.map((area) => {
                const active = focusAreas.includes(area.id);
                return (
                  <span
                    key={area.id}
                    className="focus-chip"
                    onClick={() => !locked && toggleFocusArea(area.id)}
                    style={{
                      padding: "7px 13px",
                      borderRadius: "999px",
                      border: `1px solid ${active ? "var(--gold)" : "var(--border)"}`,
                      background: active ? "rgba(201,161,90,0.16)" : "transparent",
                      color: active ? "var(--gold)" : "rgba(255,255,255,0.78)",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.82rem",
                      opacity: locked ? 0.6 : 1,
                    }}
                  >
                    {area.label}
                  </span>
                );
              })}
            </div>
          </fieldset>

          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={sectionLabelStyle}>How often would you want to check in?</span>
            <select
              value={frequency}
              disabled={locked}
              onChange={(e) => setFrequency(e.target.value as IntakeFrequency)}
              style={selectStyle}
            >
              {(Object.keys(FREQUENCY_LABELS) as IntakeFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={sectionLabelStyle}>What&rsquo;s going on? (optional -- share as much or as little as you want)</span>
            <textarea
              value={context}
              disabled={locked}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
              style={textareaStyle}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={sectionLabelStyle}>Anything else a future peer should know? (optional)</span>
            <textarea
              value={notes}
              disabled={locked}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={textareaStyle}
            />
          </label>

          {!locked && (
            <button
              type="submit"
              disabled={saving}
              style={{
                alignSelf: "flex-start",
                padding: "12px 24px",
                borderRadius: "999px",
                border: "none",
                background: "var(--gold)",
                color: "#1a0d10",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : existing ? "Save changes" : "Submit intake"}
            </button>
          )}
        </form>
      </div>
    </main>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gold)",
};

function radioLabelStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: `1px solid ${active ? "var(--gold)" : "var(--border)"}`,
    background: active ? "rgba(201,161,90,0.1)" : "transparent",
    fontFamily: "var(--font-body)",
    fontSize: "0.9rem",
    color: "#fff",
    textShadow: "0 0 6px rgba(255,255,255,0.45)",
    cursor: "pointer",
  };
}

const selectStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--void)",
  color: "#fff",
  fontSize: "0.9rem",
};

const textareaStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--void)",
  color: "#fff",
  fontSize: "0.9rem",
  resize: "vertical",
};
