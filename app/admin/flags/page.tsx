"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Stewardship's review queue -- the human-moderation side of Stewardship
// Tier 1's Flag button (lib/commons.ts's flagContent), and what several
// later Stewardship tiers in lib/practices.ts are explicitly blocked on
// ("once a review queue exists"). Every decision here goes through
// app/api/stewardship/decide/route.ts, which re-checks is_admin itself --
// nothing about seeing this page grants anything by itself.

interface FlagRow {
  id: string;
  targetType: "thread" | "reply";
  targetId: string;
  threadId: string | null;
  category: string | null;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  reporterName: string | null;
  targetAuthorName: string | null;
  preview: string;
}

export default function AdminFlagsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();
      setIsAdmin(Boolean(profileRow?.is_admin));
      setChecking(false);
      if (profileRow?.is_admin) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token ?? null;
        setAccessToken(token);
        if (token) await refresh(token);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refresh(token: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/stewardship/flags", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Couldn't load flags.");
        return;
      }
      setFlags(json.flags ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function decide(flagId: string, decision: "resolved" | "dismissed") {
    if (!accessToken) return;
    setDecidingId(flagId);
    setError(null);
    try {
      const res = await fetch("/api/stewardship/decide", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ flagId, decision }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Couldn't save that decision.");
        return;
      }
      await refresh(accessToken);
    } finally {
      setDecidingId(null);
    }
  }

  if (checking) return null;

  if (!isAdmin) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--void)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-body)",
        }}
      >
        <p>You don&rsquo;t have access to this page.</p>
      </main>
    );
  }

  const pending = flags.filter((f) => f.status === "pending");
  const decided = flags.filter((f) => f.status !== "pending");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; Admin
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.7rem",
            margin: "20px 0 6px",
          }}
        >
          Flagged Content
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--ink-dim)",
            maxWidth: "60ch",
            margin: "0 0 28px",
          }}
        >
          Every flag raised via Stewardship Tier 1 lands here first. Resolving one means you
          acted on it (removed content, followed up, etc. -- outside this page for now);
          dismissing one means it didn't need action. Nothing is auto-removed -- a flag is
          only ever a signal for you to look at.
        </p>

        {error && <p style={{ color: "var(--rose)", fontSize: "0.85rem", marginBottom: "16px" }}>{error}</p>}

        {loading ? (
          <p style={{ color: "var(--ink-faint, #5c6684)" }}>Loading&hellip;</p>
        ) : (
          <>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", margin: "0 0 12px" }}>
              Pending ({pending.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
              {pending.length === 0 && (
                <p style={{ color: "var(--ink-faint, #5c6684)", fontSize: "0.85rem" }}>Nothing waiting right now.</p>
              )}
              {pending.map((f) => (
                <div
                  key={f.id}
                  style={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "14px 16px",
                  }}
                >
                  <p style={{ margin: "0 0 6px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-faint, #5c6684)" }}>
                    {f.targetType === "thread" ? "Thread" : "Reply"} by {f.targetAuthorName || "Unknown"} &middot; flagged
                    by {f.reporterName || "Unknown"}
                    {f.category ? ` · ${f.category}` : ""} &middot; {new Date(f.createdAt).toLocaleDateString()}
                  </p>
                  <p style={{ margin: "0 0 12px", fontFamily: "var(--font-body)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                    {f.preview}
                  </p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {f.threadId && (
                      <Link
                        href={`/commons/t/${f.threadId}`}
                        target="_blank"
                        style={{ color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", textDecoration: "none", marginRight: "4px" }}
                      >
                        View thread &rarr;
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={decidingId === f.id}
                      onClick={() => decide(f.id, "resolved")}
                      style={primaryButtonStyle}
                    >
                      Resolved
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === f.id}
                      onClick={() => decide(f.id, "dismissed")}
                      style={dangerButtonStyle}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", margin: "0 0 12px" }}>Decided</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {decided.length === 0 && (
                <p style={{ color: "var(--ink-faint, #5c6684)", fontSize: "0.85rem" }}>Nothing decided yet.</p>
              )}
              {decided.map((f) => (
                <div
                  key={f.id}
                  style={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    opacity: 0.75,
                  }}
                >
                  <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "0.85rem" }}>{f.preview.slice(0, 80)}</p>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: f.status === "resolved" ? "var(--gold)" : "var(--rose)",
                      flexShrink: 0,
                    }}
                  >
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "var(--gold)",
  color: "var(--void)",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "0.78rem",
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--rose)",
  background: "none",
  color: "var(--rose)",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "0.78rem",
  cursor: "pointer",
};
