"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    // If email confirmation is required (default Supabase setting), there is
    // no session yet -- signUp() succeeds but signs no one in until they
    // click the confirmation link. Tell the person that plainly rather than
    // silently redirecting them to a page that will just bounce them back.
    if (mode === "signup" && !result.data.session) {
      setError(
        "Check your inbox to confirm your email, then come back and sign in. (You can turn email confirmation off in Supabase while testing -- see the README.)"
      );
      return;
    }

    router.push("/star-day");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--void)",
        padding: "24px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "11px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--gold)",
            textAlign: "center",
            marginBottom: "6px",
          }}
        >
          Same Heart&trade;
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.4rem",
            textAlign: "center",
            margin: "0 0 8px",
          }}
        >
          {mode === "signup" ? "Arrive" : "Welcome back"}
        </h1>

        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="password (6+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "var(--rose, #c9576a)", fontSize: "0.85rem", fontFamily: "var(--font-body)" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === "signup" ? "signin" : "signup");
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--ink-dim, #9aa3b8)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.04em",
            cursor: "pointer",
            marginTop: "4px",
          }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--panel, #121a2c)",
  border: "1px solid #313f5e",
  borderRadius: "10px",
  padding: "12px 14px",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: "0.95rem",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--gold)",
  border: "none",
  borderRadius: "999px",
  padding: "12px 18px",
  color: "var(--void)",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "6px",
};
