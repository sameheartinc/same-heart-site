"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import { getLevel, nextPrimeThreshold } from "@/lib/primeLevels";
import { DEEP_SIGNALS, CATEGORY_LABELS } from "@/lib/deepSignals";

const ACCENT = "#5b5fc7";

// Deep Signals -- see lib/deepSignals.ts for the full reasoning. This
// page is deliberately built around mystery: only the very next Signal
// shows its teaser, everything further out is just a locked number.
// Nothing here is a game mechanic bolted onto real content -- the
// content itself (media literacy, drug prevention, youth opportunity)
// is the point; the unlock sequence is just what makes coming back to
// read the next one feel worth it, exactly as Rob described.
export default function DeepSignalsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase.from("profiles").select("xp").eq("id", userData.user.id).single();
      setXp((data as { xp: number } | null)?.xp ?? 0);
      setChecking(false);
    })();
  }, [router]);

  if (checking) return <PageLoading />;

  const level = getLevel(xp);
  const nextThreshold = nextPrimeThreshold(xp);
  const unlocked = DEEP_SIGNALS.filter((s) => s.unlockLevel <= level);
  const locked = DEEP_SIGNALS.filter((s) => s.unlockLevel > level);
  const nextUp = locked[0];
  const stillHidden = locked.slice(1);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <Link
          href="/galaxy"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-display)",
            fontSize: "0.82rem",
            textDecoration: "none",
          }}
        >
          &larr; Back to the Galaxy
        </Link>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: ACCENT,
            margin: "22px 0 8px",
          }}
        >
          Deep Signals
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.7rem", margin: "0 0 10px" }}>
          Real information, unlocked as you grow.
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            maxWidth: "56ch",
            margin: "0 0 26px",
          }}
        >
          Anyone can search for information. This is different -- a sequence of real,
          sourced signals on two things worth understanding clearly: how to read the
          world without being misled, and what actually helps young people avoid
          substance use and find a real future. One unlocks each time you level up.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            padding: "12px 16px",
            borderRadius: "12px",
            background: "var(--panel)",
            border: `1px solid ${ACCENT}55`,
            marginBottom: "30px",
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem" }}>
            Level {level} &middot; {unlocked.length} of {DEEP_SIGNALS.length} Signals received
          </span>
          {nextThreshold != null && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.04em",
                color: "var(--ink-faint, #5c6684)",
              }}
            >
              {nextThreshold - xp} Heartbeats to your next level
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {unlocked.map((s) => (
            <div
              key={s.id}
              style={{
                padding: "18px 20px",
                borderRadius: "14px",
                background: "var(--panel)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "8px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: ACCENT,
                    border: `1px solid ${ACCENT}88`,
                    borderRadius: "999px",
                    padding: "2px 9px",
                  }}
                >
                  {CATEGORY_LABELS[s.category]}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--ink-faint, #5c6684)" }}>
                  Signal {s.id}
                </span>
              </div>
              <p style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem" }}>
                {s.title}
              </p>
              <p
                style={{
                  margin: "0 0 12px",
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  fontSize: "0.85rem",
                  color: "var(--ink-dim)",
                }}
              >
                {s.teaser}
              </p>
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-body)", fontSize: "0.92rem", lineHeight: 1.65 }}>
                {s.body}
              </p>
              {s.internalHref ? (
                <Link
                  href={s.internalHref}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--gold)", textDecoration: "none" }}
                >
                  {s.internalLabel} &rarr;
                </Link>
              ) : (
                s.sourceHref && (
                  <a
                    href={s.sourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--gold)", textDecoration: "none" }}
                  >
                    {s.sourceLabel} &rarr;
                  </a>
                )
              )}
            </div>
          ))}

          {nextUp && (
            <div
              style={{
                padding: "18px 20px",
                borderRadius: "14px",
                background: "var(--panel)",
                border: `1px dashed ${ACCENT}88`,
              }}
            >
              <p
                style={{
                  margin: "0 0 6px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: ACCENT,
                }}
              >
                Signal {nextUp.id} -- unlocks at Level {nextUp.unlockLevel}
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  fontSize: "0.9rem",
                  color: "var(--ink-dim)",
                }}
              >
                {nextUp.teaser}
              </p>
            </div>
          )}

          {stillHidden.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                padding: "14px 16px",
              }}
            >
              {stillHidden.map((s) => (
                <span
                  key={s.id}
                  title={`Unlocks at Level ${s.unlockLevel}`}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.06em",
                    color: "var(--ink-faint, #5c6684)",
                    border: "1px solid var(--border)",
                    borderRadius: "999px",
                    padding: "4px 10px",
                  }}
                >
                  ? Signal {s.id}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
