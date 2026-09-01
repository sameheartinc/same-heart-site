"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Monetization gate, part 4 -- Rob's own approval queue. This is the
// only place an application ever gets decided (via
// app/api/monetization/decide/route.ts, which re-checks is_admin
// itself). Nothing about crossing the eligibility threshold (holding
// all four Heart Strings -- see lib/evolution.ts) grants anything by
// itself; every row here waits for a real decision from Rob.

interface ApplicationRow {
  id: string;
  profileId: string;
  status: "pending" | "approved" | "denied";
  appliedAt: string;
  decidedAt: string | null;
  displayName: string | null;
  designation: string | null;
  standing: string | null;
  sparkId: number | null;
}

export default function AdminMonetizationPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
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

  // profiles' RLS only ever lets someone read their own row, so this
  // list (which needs every applicant's name/designation/standing) has
  // to come from a server route running with the service role -- see
  // app/api/monetization/list/route.ts, which re-checks is_admin itself.
  async function refresh(token: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/monetization/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Couldn't load applications.");
        return;
      }
      setApplications(json.applications ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function decide(applicationId: string, decision: "approved" | "denied") {
    if (!accessToken) return;
    setDecidingId(applicationId);
    setError(null);
    try {
      const res = await fetch("/api/monetization/decide", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, decision }),
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

  const pending = applications.filter((a) => a.status === "pending");
  const decided = applications.filter((a) => a.status !== "pending");

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
          Monetization Applications
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--ink-dim)",
            maxWidth: "60ch",
            margin: "0 0 28px",
          }}
        >
          Everyone here has already earned the ability to apply by holding all four Heart
          Strings -- that only unlocks the application, never anything else. Approving
          someone sets profiles.monetization_approved; no payment features exist yet, so
          this is the gate itself, not a payout.
        </p>

        {error && (
          <p style={{ color: "var(--rose)", fontSize: "0.85rem", marginBottom: "16px" }}>{error}</p>
        )}

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
              {pending.map((app) => (
                <div
                  key={app.id}
                  style={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: "0 0 2px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>
                      {app.displayName || "Unnamed"}
                      {app.sparkId != null && (
                        <span style={{ color: "var(--ink-faint, #5c6684)", fontWeight: 400 }}> &middot; Spark #{app.sparkId}</span>
                      )}
                    </p>
                    <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-faint, #5c6684)" }}>
                      {app.designation} &middot; {app.standing} &middot; applied {new Date(app.appliedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={decidingId === app.id}
                      onClick={() => decide(app.id, "approved")}
                      style={primaryButtonStyle}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === app.id}
                      onClick={() => decide(app.id, "denied")}
                      style={dangerButtonStyle}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", margin: "0 0 12px" }}>
              Decided
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {decided.length === 0 && (
                <p style={{ color: "var(--ink-faint, #5c6684)", fontSize: "0.85rem" }}>Nothing decided yet.</p>
              )}
              {decided.map((app) => (
                <div
                  key={app.id}
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
                  <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.9rem" }}>
                    {app.displayName || "Unnamed"}
                  </p>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: app.status === "approved" ? "var(--gold)" : "var(--rose)",
                    }}
                  >
                    {app.status}
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
