"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// "Connect with Same Heart" -- the consent screen for the handshake
// described in lib/communityApi.ts and supabase/schema.sql's
// community_connect_codes. An outside business links a visitor here
// with ?clientId=<their API key's id>&redirectUri=<where to send them
// back>&state=<anything they want echoed back>. This page's whole job
// is: confirm the link is real, make sure a real signed-in person is
// looking at it, ask them plainly what approving does, and only ever
// act on an explicit Approve click.
export default function ConnectPage() {
  // useSearchParams needs a Suspense boundary in the app router -- same
  // no-op wrapper app/login/page.tsx already uses.
  return (
    <Suspense fallback={null}>
      <ConnectPageInner />
    </Suspense>
  );
}

type Status = "checking" | "invalid" | "needs-login" | "ready" | "granting" | "denied-redirecting";

function ConnectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId") ?? "";
  const redirectUri = searchParams.get("redirectUri") ?? "";
  const state = searchParams.get("state") ?? "";

  const [status, setStatus] = useState<Status>("checking");
  const [communityName, setCommunityName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !redirectUri) {
      setStatus("invalid");
      setError("This link is missing what it needs to work.");
      return;
    }

    (async () => {
      const res = await fetch(
        `/api/v1/connect/app?clientId=${encodeURIComponent(clientId)}&redirectUri=${encodeURIComponent(redirectUri)}`
      );
      const json = await res.json();
      if (!res.ok) {
        setStatus("invalid");
        setError(json.error ?? "This connection link isn't valid.");
        return;
      }
      setCommunityName(json.communityName);

      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user as { is_anonymous?: boolean } | undefined;
      if (!data.session || sessionUser?.is_anonymous) {
        setStatus("needs-login");
        const here = `/connect?${searchParams.toString()}`;
        router.replace(`/login?next=${encodeURIComponent(here)}`);
        return;
      }

      setStatus("ready");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, redirectUri]);

  async function approve() {
    setStatus("granting");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setStatus("needs-login");
      router.replace(`/login?next=${encodeURIComponent(`/connect?${searchParams.toString()}`)}`);
      return;
    }

    const res = await fetch("/api/v1/connect/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientId, redirectUri, state }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus("ready");
      setError(json.error ?? "Couldn't complete that connection right now.");
      return;
    }

    const target = new URL(redirectUri);
    target.searchParams.set("code", json.code);
    if (state) target.searchParams.set("state", state);
    window.location.href = target.toString();
  }

  function deny() {
    setStatus("denied-redirecting");
    try {
      const target = new URL(redirectUri);
      target.searchParams.set("error", "access_denied");
      if (state) target.searchParams.set("state", state);
      window.location.href = target.toString();
    } catch {
      router.replace("/hub");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "420px",
          width: "100%",
          padding: "28px 26px",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          background: "#fff",
        }}
      >
        <p
          style={{
            margin: "0 0 16px",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--gold)",
          }}
        >
          Same Heart &middot; Connect
        </p>

        {status === "checking" || status === "needs-login" || status === "denied-redirecting" ? (
          <p style={{ color: "var(--ink-dim)", fontFamily: "var(--font-body)" }}>One moment&hellip;</p>
        ) : status === "invalid" ? (
          <>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", margin: "0 0 10px" }}>
              This link isn't valid
            </h1>
            <p style={{ color: "var(--ink-dim)", fontFamily: "var(--font-body)", fontSize: "0.9rem" }}>{error}</p>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", margin: "0 0 14px" }}>
              Connect your account to {communityName}?
            </h1>
            <p style={{ color: "var(--ink-dim)", fontFamily: "var(--font-body)", fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 10px" }}>
              Approving this will:
            </p>
            <ul style={{ color: "var(--ink-dim)", fontFamily: "var(--font-body)", fontSize: "0.88rem", lineHeight: 1.7, margin: "0 0 20px", paddingLeft: "20px" }}>
              <li>Add you as a member of {communityName}, if you aren't already</li>
              <li>Share your display name, Standing tier, and leading Practice with {communityName}'s own site or app</li>
            </ul>
            {error && <p style={{ color: "#c9576a", fontSize: "0.85rem", marginBottom: "14px" }}>{error}</p>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={approve}
                disabled={status === "granting"}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: "999px",
                  border: "none",
                  background: "var(--gold)",
                  color: "#1a1410",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: status === "granting" ? "default" : "pointer",
                  opacity: status === "granting" ? 0.6 : 1,
                }}
              >
                {status === "granting" ? "Connecting…" : "Approve"}
              </button>
              <button
                onClick={deny}
                disabled={status === "granting"}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  background: "none",
                  color: "var(--ink-dim)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
