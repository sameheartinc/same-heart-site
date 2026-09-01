"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import { listMyTransmissions, type Transmission } from "@/lib/exchange";
import { getWorldIssue } from "@/lib/worldIssues";
import { KEY_INFO } from "@/lib/keys";

// The Green Key's door (see PLAN.md's Keys and Doors section, and
// lib/keys.ts). Deliberately a keepsake, not a leaderboard -- there's no
// ranking against anyone else here, just a personal record of every real
// transmission someone's sent and what it actually scored. Gated the
// same way /admin/skins is gated: the check in this component only
// controls what's *shown* -- exchange_transmissions is filtered by
// profile_id in lib/exchange.ts's listMyTransmissions, and RLS on
// profile_keys already means nobody can read another profile's earned
// keys to begin with, so there's nothing to fake here even without this
// page-level check.
export default function ImpactHistoryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasGreenKey, setHasGreenKey] = useState(false);
  const [transmissions, setTransmissions] = useState<Transmission[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data: keyRows } = await supabase
        .from("profile_keys")
        .select("key_color")
        .eq("profile_id", userData.user.id)
        .eq("key_color", "green");

      const held = Boolean(keyRows && keyRows.length > 0);
      setHasGreenKey(held);

      if (held) {
        const rows = await listMyTransmissions();
        setTransmissions(rows);
      }

      setChecking(false);
    })();
  }, [router]);

  if (checking) return <PageLoading />;

  if (!hasGreenKey) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--void)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 22px",
          fontFamily: "var(--font-body)",
        }}
      >
        <div style={{ maxWidth: "440px", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-faint, #a29cb0)",
              marginBottom: "14px",
            }}
          >
            Locked
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.4rem",
              margin: "0 0 14px",
            }}
          >
            This page opens with the Green Heart String
          </h1>
          <p style={{ color: "var(--ink-dim)", lineHeight: 1.6, margin: "0 0 22px" }}>
            {KEY_INFO.green.blurb} Transmit a handful of links through the Exchange in Commons
            that genuinely engage with a real-world issue, and this becomes your own record of
            it -- not a leaderboard, just a keepsake of what you actually sent.
          </p>
          <Link
            href="/commons"
            style={{
              color: "var(--gold)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            &larr; Back to Commons
          </Link>
        </div>
      </main>
    );
  }

  const scored = transmissions.filter((t) => typeof t.impact_score === "number");
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, t) => sum + (t.impact_score ?? 0), 0) / scored.length)
      : 0;
  const totalHeartbeats = transmissions.reduce((sum, t) => sum + (t.heartbeats_awarded ?? 0), 0);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <Link
          href="/hub"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; Same Heart
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.7rem",
            margin: "20px 0 6px",
          }}
        >
          Impact History
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--ink-dim)",
            maxWidth: "60ch",
            margin: "0 0 28px",
          }}
        >
          Every link you&rsquo;ve transmitted through the Exchange, and what it actually scored.
          Earned by holding the Green Heart String -- for your eyes only.
        </p>

        <div
          style={{
            display: "flex",
            gap: "28px",
            flexWrap: "wrap",
            padding: "16px 20px",
            marginBottom: "28px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            background: "var(--panel)",
          }}
        >
          <Stat label="Transmissions" value={String(transmissions.length)} />
          <Stat label="Average score" value={`${avgScore}/100`} />
          <Stat label="Heartbeats earned" value={String(totalHeartbeats)} />
        </div>

        {transmissions.length === 0 ? (
          <p style={{ color: "var(--ink-faint, #a29cb0)", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
            Nothing recorded yet -- the transmission that earned this Heart String should be right here
            once the page catches up. Try reloading in a moment.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {transmissions.map((t) => {
              const issue = getWorldIssue(t.issue_key);
              const date = new Date(t.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  key={t.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    background: "var(--panel)",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--ink)",
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: "0.98rem",
                        textDecoration: "none",
                      }}
                    >
                      {t.title || t.domain || t.url}
                    </a>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "var(--gold)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.impact_score ?? 0}/100 &middot; +{t.heartbeats_awarded} Heartbeats
                    </span>
                  </div>
                  {t.tagline && (
                    <p style={{ margin: "6px 0 0", color: "var(--ink-dim)", fontStyle: "italic" }}>
                      &ldquo;{t.tagline}&rdquo;
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "8px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--ink-faint, #a29cb0)",
                    }}
                  >
                    {issue && <span>{issue.label}</span>}
                    <span>{date}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-faint, #a29cb0)",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem" }}>{value}</div>
    </div>
  );
}
