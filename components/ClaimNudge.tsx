"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// A one-time, timed nudge toward "Claim your account" (the same flow
// app/hub/page.tsx's static link already points at -- see
// app/login/page.tsx's claimMode) -- Rob, Nov 23 2026: "a prompt pop up
// once a user has been on the site a few minutes reminding them to sign
// up with their email and secure an account." Mounted once at the root
// layout alongside GlobalPlayer/GalaxyNav, so the timer below survives
// client-side navigation instead of restarting on every page.
//
// Why this needs to exist at all: an anonymous Supabase session
// (lib/session.ts) is real and persists across a refresh on the SAME
// browser/device, which is what already lets Cards, XP, Path, and
// everything else in profile_unlocks survive a normal visit. What it
// doesn't survive is a different device, a cleared browser, or
// switching browsers -- only a claimed (real email/password) account
// does that. This nudge exists to close that gap before someone
// discovers it the hard way.
const HIDDEN_PATHS = ["/", "/login"];

// How long someone's on the site before the nudge appears.
const NUDGE_DELAY_MS = 3 * 60 * 1000;

// If dismissed with "Not now," don't show it again for this long --
// long enough not to nag every visit, short enough to come back around.
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const SNOOZE_KEY = "same-heart:claim-nudge-snoozed-until";

function isSnoozed(): boolean {
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    return raw ? Date.now() < Number(raw) : false;
  } catch {
    // Private-window/blocked storage -- fail open (never snoozed) rather
    // than crash; worst case the nudge shows again next visit.
    return false;
  }
}

function snooze() {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    // Nothing to persist -- the nudge just won't remember being
    // dismissed this session, which is a fine fallback.
  }
}

export default function ClaimNudge() {
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isSnoozed()) return;

    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const isAnonymous = Boolean((data.user as { is_anonymous?: boolean }).is_anonymous);
      if (!isAnonymous) return; // Already claimed -- nothing to nudge.

      timerRef.current = setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, NUDGE_DELAY_MS);
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Deliberately runs once per app load, not per navigation -- see the
    // file header on why this is mounted at the root layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hiddenHere = HIDDEN_PATHS.includes(pathname);
  if (!visible || hiddenHere) return null;

  function dismiss() {
    snooze();
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Secure your account"
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 960,
        background: "rgba(5,6,12,0.72)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "360px",
          background: "var(--panel)",
          border: "1px solid rgba(201,161,90,0.4)",
          borderRadius: "14px",
          padding: "22px 20px",
          boxShadow: "0 0 40px rgba(201,161,90,0.18)",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.05rem",
            color: "var(--ink)",
          }}
        >
          Don&rsquo;t lose this.
        </p>
        <p
          style={{
            margin: "0 0 18px",
            fontFamily: "var(--font-body)",
            fontSize: "0.86rem",
            color: "var(--ink-dim)",
            lineHeight: 1.5,
          }}
        >
          Right now everything you&rsquo;ve earned here is tied to this device. Secure your account
          with an email -- takes a minute -- and it&rsquo;s yours anywhere, plus you get to pick a
          card as a thank-you.
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={() => router.push("/login?claim=1")}
            style={{
              flex: 1,
              background: "var(--gold)",
              border: "none",
              borderRadius: "999px",
              padding: "10px 14px",
              color: "var(--void)",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Secure my account
          </button>
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "999px",
              padding: "10px 14px",
              color: "var(--ink-dim)",
              fontFamily: "var(--font-body)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
