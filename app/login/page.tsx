"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureSession } from "@/lib/session";
import { getTurnstileToken } from "@/lib/turnstile";
import { usePathSignal } from "@/lib/cursorSignal";
import { AxisScores, PathKey, PATHS, combineScores, pickPath } from "@/lib/paths";
import { ONBOARDING_WORLD, WORLDS } from "@/lib/worlds";
import PathOnboarding from "@/components/PathOnboarding";
import WorldField from "@/components/WorldField";

type Stage = "gate" | "entering" | "quiz" | "revealing" | "ship" | "arriving" | "form";

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary in the app router -- this
  // page is fully client-rendered anyway, so it's a no-op in practice.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimMode = searchParams.get("claim") === "1";

  const [stage, setStage] = useState<Stage>(claimMode ? "form" : "gate");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [arrivalMessage, setArrivalMessage] = useState("Something in you just answered.");
  const [userId, setUserId] = useState<string | null>(null);
  const [pathKey, setPathKey] = useState<PathKey | null>(null);

  const cursorSignal = usePathSignal();
  const path = pathKey ? PATHS[pathKey] : null;
  const backgroundWorld = pathKey ? WORLDS[pathKey] : ONBOARDING_WORLD;

  // Claim mode: someone already has an anonymous session (they've been
  // using the site) and followed "Claim your account" from the Hub. If
  // they're not actually anonymous -- already claimed, or somehow landed
  // here with no session at all -- skip straight past this screen.
  useEffect(() => {
    if (!claimMode) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user as { is_anonymous?: boolean } | null;
      if (user && user.is_anonymous === false) {
        router.replace("/hub");
      }
      // No user at all, or genuinely anonymous: fall through and show the
      // form -- handleSubmit below does the right thing either way.
    })();
  }, [claimMode, router]);

  // Google (and any future OAuth provider) redirects back here with
  // ?oauth=1. supabase-js parses the returned token and establishes the
  // session itself; this just waits for that to land and then routes the
  // same way any other sign-in does, instead of leaving the gate showing.
  useEffect(() => {
    if (searchParams.get("oauth") !== "1") return;
    setStage("entering");
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setUserId(data.session.user.id);
          await continueAfterEntry(data.session.user.id);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (!cancelled) setStage("gate");
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function continueAfterEntry(existingUserId: string) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("archetype")
      .eq("id", existingUserId)
      .single();

    if (profileData?.archetype) {
      setArrivalMessage("Welcome back to the frequency.");
      setStage("arriving");
      setTimeout(() => router.push("/hub"), 1400);
      return;
    }

    // Signed in (or already had a session) but never finished the
    // founding sequence -- pick up right where that left off.
    setStage("quiz");
  }

  async function handleGoogleSignIn() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login?oauth=1` },
    });
    if (error) setError(error.message);
  }

  async function openGate() {
    if (stage !== "gate") return;
    setStage("entering");

    const [{ data }] = await Promise.all([
      supabase.auth.getSession(),
      new Promise((resolve) => setTimeout(resolve, 700)),
    ]);

    if (data.session) {
      setUserId(data.session.user.id);
      await continueAfterEntry(data.session.user.id);
      return;
    }

    try {
      const session = await ensureSession();
      if (!session) throw new Error("no session");
      setUserId(session.user.id);
      setStage("quiz");
    } catch {
      // Anonymous sign-ins may not be enabled yet in Supabase, or the
      // network hiccupped -- fall back to a real account instead of
      // stranding someone on a dead screen.
      setStage("form");
    }
  }

  async function handlePathComplete(onboardingScores: AxisScores) {
    const combined = combineScores(onboardingScores, cursorSignal.axisScores);
    const { path: chosen, confidence } = pickPath(combined);
    setPathKey(chosen);

    if (userId) {
      await supabase
        .from("profiles")
        .update({
          path_key: chosen,
          path_confidence: confidence,
          path_signals: combined,
          path_assigned_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    setStage("revealing");
    setTimeout(() => setStage("ship"), 2600);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (claimMode) {
      const result = await supabase.auth.updateUser({ email, password });
      setLoading(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setArrivalMessage("Your account is permanent now.");
      setStage("arriving");
      setTimeout(() => router.push("/hub"), 1400);
      return;
    }

    // Same invisible Turnstile check lib/session.ts already uses for
    // anonymous entry -- this covers the explicit email/password path too,
    // which never had a token before. Supabase ignores a missing/null
    // token when CAPTCHA protection isn't turned on yet, so this is safe
    // to ship ahead of flipping that setting on.
    const captchaToken = await getTurnstileToken();
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: captchaToken ? { captchaToken } : undefined })
        : await supabase.auth.signInWithPassword({
            email,
            password,
            options: captchaToken ? { captchaToken } : undefined,
          });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setError(
        "Check your inbox to confirm your email, then come back and sign in. (You can turn email confirmation off in Supabase while testing -- see the README.)"
      );
      return;
    }

    const uid = result.data.user?.id;
    if (uid) {
      setUserId(uid);
      await continueAfterEntry(uid);
      return;
    }

    setArrivalMessage(
      mode === "signup" ? "Something in you just answered." : "Welcome back to the frequency."
    );
    setStage("arriving");
    setTimeout(() => router.push("/star-day"), 1400);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {!claimMode && <WorldField world={backgroundWorld} />}

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,161,90,0.12), transparent 60%)",
        }}
      />

      <style>{`
        @keyframes gatePulse {
          0%   { transform: scale(1);    filter: drop-shadow(0 0 0 rgba(201,161,90,0.5)); }
          14%  { transform: scale(1.045); filter: drop-shadow(0 0 18px rgba(201,161,90,0.35)); }
          28%  { transform: scale(1);    filter: drop-shadow(0 0 4px rgba(201,161,90,0.25)); }
          42%  { transform: scale(1.03); filter: drop-shadow(0 0 12px rgba(201,161,90,0.2)); }
          65%  { transform: scale(1);    filter: drop-shadow(0 0 0 rgba(201,161,90,0)); }
          100% { transform: scale(1);    filter: drop-shadow(0 0 0 rgba(201,161,90,0)); }
        }
        @keyframes gateAnswer {
          0%   { transform: scale(1);    filter: drop-shadow(0 0 0 rgba(201,161,90,0.6)); }
          40%  { transform: scale(1.18); filter: drop-shadow(0 0 40px rgba(201,161,90,0.65)); }
          100% { transform: scale(1.4);  filter: drop-shadow(0 0 0 rgba(201,161,90,0)); opacity: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes shFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .gate-mark { animation: gatePulse 2.8s ease-in-out infinite; cursor: pointer; }
        .gate-mark:hover { animation-play-state: paused; }
        .gate-mark.answering { animation: gateAnswer 0.7s ease-out forwards; cursor: default; }
        .gate-fade-out { animation: fadeOut 0.4s ease forwards; }
        .form-fade-in { animation: fadeUp 0.6s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .gate-mark, .gate-mark.answering { animation: none; }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "480px" }}>
        {(stage === "gate" || stage === "entering") && (
          <div
            className={stage === "entering" ? "gate-fade-out" : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "22px",
              textAlign: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mark.png"
              alt="Same Heart"
              onClick={openGate}
              className={`gate-mark${stage === "entering" ? " answering" : ""}`}
              style={{ width: "min(140px, 32vw)", height: "auto" }}
            />
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                color: "var(--ink-dim)",
                maxWidth: "34ch",
                fontSize: "1.02rem",
                margin: 0,
              }}
            >
              A vibration, unannounced but profoundly needed.
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-faint)",
                margin: 0,
              }}
            >
              Touch the mark to arrive
            </p>
            {stage === "gate" && (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setStage("form");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-faint)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  textDecoration: "underline",
                  cursor: "pointer",
                  marginTop: "-8px",
                }}
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        )}

        {stage === "quiz" && (
          <div className="form-fade-in" style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "11px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--gold)",
                marginBottom: "26px",
              }}
            >
              Same Heart&trade; &middot; First Signal
            </p>
            <PathOnboarding onComplete={handlePathComplete} />
          </div>
        )}

        {stage === "revealing" && path && (
          <div className="form-fade-in" style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                color: "var(--ink-dim)",
                marginBottom: "10px",
              }}
            >
              You walk like&hellip;
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "clamp(2.2rem, 7vw, 3.2rem)",
                margin: 0,
                color: path.accent,
              }}
            >
              {path.name}
            </h1>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                maxWidth: "40ch",
                margin: "18px auto 0",
                fontSize: "1.05rem",
              }}
            >
              {path.tagline}
            </p>
          </div>
        )}

        {stage === "ship" && path && (
          <div className="form-fade-in" style={{ textAlign: "center" }}>
            <div
              aria-hidden="true"
              style={{
                width: "84px",
                height: "84px",
                margin: "0 auto 22px",
                animation: "shFloat 4s ease-in-out infinite",
                filter: `drop-shadow(0 0 22px ${path.accent}aa)`,
              }}
            >
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 6 L78 62 L50 48 L22 62 Z" fill={path.accent} fillOpacity="0.85" />
                <path d="M50 48 L50 94 L38 78 Z M50 48 L50 94 L62 78 Z" fill={path.accent} fillOpacity="0.4" />
              </svg>
            </div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                color: "var(--ink-dim)",
                marginBottom: "10px",
              }}
            >
              Your vessel is ready.
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                maxWidth: "40ch",
                margin: "0 auto 26px",
                fontSize: "1rem",
              }}
            >
              {path.essence}
            </p>
            <button
              onClick={() => router.push("/star-day")}
              style={{ ...buttonStyle, background: path.accent }}
            >
              Set off
            </button>
          </div>
        )}

        {stage === "form" && (
          <form
            onSubmit={handleSubmit}
            className="form-fade-in"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mark.png"
              alt="Same Heart"
              style={{ width: "56px", height: "auto", margin: "0 auto 4px" }}
            />
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
              {claimMode ? "Claim your account" : mode === "signup" ? "Arrive" : "Welcome back"}
            </h1>
            {claimMode && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  color: "var(--ink-dim)",
                  textAlign: "center",
                  fontSize: "0.9rem",
                  margin: "0 0 6px",
                }}
              >
                Everything you've already done stays exactly as it is -- this
                just makes it recoverable on another device.
              </p>
            )}

            {!claimMode && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  style={googleButtonStyle}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                  </svg>
                  Continue with Google
                </button>
                <div style={dividerStyle}>
                  <span style={dividerLineStyle} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.08em", color: "var(--ink-faint)" }}>OR</span>
                  <span style={dividerLineStyle} />
                </div>
              </>
            )}

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
              <p style={{ color: "var(--rose)", fontSize: "0.85rem", fontFamily: "var(--font-body)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? "…" : claimMode ? "Claim account" : mode === "signup" ? "Create account" : "Sign in"}
            </button>

            {!claimMode && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode(mode === "signup" ? "signin" : "signup");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                  marginTop: "4px",
                }}
              >
                {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
            )}
          </form>
        )}

        {stage === "arriving" && (
          <p
            className="form-fade-in"
            style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              color: "var(--ink)",
              fontSize: "1.15rem",
              maxWidth: "30ch",
              textAlign: "center",
              margin: "0 auto",
            }}
          >
            {arrivalMessage}
          </p>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
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

const googleButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "11px 14px",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: "0.92rem",
  fontWeight: 500,
  cursor: "pointer",
};

const dividerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  margin: "2px 0",
};

const dividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: "1px",
  background: "var(--border)",
};
