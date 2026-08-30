"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { listRoster, type RankedProfile } from "@/lib/exchange";

const ACCENT = "#7c9fd9";

// The Roster -- who's actually shown up and contributed, ranked by
// Heartbeats. Deliberately public to every signed-in person (a
// reversal of the original "keep XP/Standing private" instinct, made on
// purpose so ranking means something) -- see public_rankings in
// schema.sql, a narrow view that exposes only what ranking needs.
export default function RosterPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RankedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setChecking(false);
      setRoster(await listRoster(100));
      setLoading(false);
    })();
  }, [router]);

  if (checking) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <Link
          href="/commons"
          style={{
            color: "var(--ink-faint, #5c6684)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; Back to the Commons
        </Link>

        <p
          style={{
            margin: "22px 0 6px",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          Fleet Standing
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.6rem",
            margin: "0 0 8px",
          }}
        >
          The Roster
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            fontSize: "0.9rem",
            margin: "0 0 30px",
            maxWidth: "52ch",
          }}
        >
          Ranked by Heartbeats -- earned by showing up, contributing, and
          transmitting real impact through the Exchange. Never bought.
        </p>

        {loading ? null : roster.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)" }}>
            No ships on record yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {roster.map((p, i) => {
              const isSelf = p.id === userId;
              const label = p.designation || p.display_name || `Spark #${p.spark_id ?? "?"}`;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: isSelf ? "rgba(201,161,90,0.08)" : "var(--panel)",
                    border: `1px solid ${isSelf ? "var(--gold)" : "var(--border)"}`,
                  }}
                >
                  <span
                    style={{
                      width: "28px",
                      textAlign: "right",
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      color: i < 3 ? "var(--gold)" : "var(--ink-faint, #5c6684)",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: "0.92rem",
                        color: isSelf ? "var(--gold)" : "var(--ink)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {label}
                      {isSelf && " (you)"}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontFamily: "var(--font-mono)",
                        fontSize: "9px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--ink-faint, #5c6684)",
                      }}
                    >
                      {p.standing}
                      {p.current_streak > 0 && ` · ${p.current_streak} day streak`}
                    </p>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      color: ACCENT,
                      flexShrink: 0,
                    }}
                  >
                    {p.xp}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
