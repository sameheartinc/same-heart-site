"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { fetchWhoIsHere, KEY_INFO, type PresentProfile } from "@/lib/keys";

const ACCENT = KEY_INFO.red.accent;

// Red key's door -- "you've proven you show up, so you get to see the
// room." The actual list only ever comes from
// app/api/presence/who-is-here/route.ts, which checks the key itself;
// this page just calls it and shows whatever comes back. A null result
// (not signed in, or the key isn't held) shows the locked state below
// rather than an empty list that would look broken or, worse, like
// nobody's ever around.
export default function WhoIsHerePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [present, setPresent] = useState<PresentProfile[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
      setPresent(await fetchWhoIsHere());
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
      <div style={{ maxWidth: "620px", margin: "0 auto" }}>
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
          Red Heart String
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.6rem",
            margin: "0 0 8px",
          }}
        >
          Who&rsquo;s Here
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
          Everyone active in the last five minutes. You&rsquo;ve proven you show up,
          so you get to see the room.
        </p>

        {loading ? null : present === null ? (
          <div
            style={{
              padding: "20px",
              borderRadius: "12px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
            }}
          >
            <p style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>
              This one&rsquo;s locked.
            </p>
            <p style={{ margin: 0, fontFamily: "var(--font-body)", color: "var(--ink-dim)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              {KEY_INFO.red.blurb} Once the Red Heart String is yours, this page turns into a real,
              live view of who else is around right now.
            </p>
          </div>
        ) : present.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)" }}>
            Quiet right now -- nobody&rsquo;s been active in the last five minutes.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {present.map((p) => {
              const isSelf = p.id === userId;
              const label = p.designation || p.display_name || `Spark #${p.spark_id ?? "?"}`;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: isSelf ? "rgba(217,80,63,0.08)" : "var(--panel)",
                    border: `1px solid ${isSelf ? ACCENT : "var(--border)"}`,
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#5fd97f",
                      boxShadow: "0 0 6px #5fd97f99",
                      flexShrink: 0,
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      color: isSelf ? ACCENT : "var(--ink)",
                    }}
                  >
                    {label}
                    {isSelf && " (you)"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
