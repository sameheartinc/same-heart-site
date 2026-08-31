"use client";

import Link from "next/link";
import { useRef } from "react";

// Deterministic pseudo-random stars -- same values on server and client,
// so there's no hydration mismatch and no need to wait for JS to draw them.
function seeded(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}
const STARS = Array.from({ length: 110 }, (_, i) => ({
  left: seeded(i * 12.9898) * 100,
  top: seeded(i * 78.233 + 1) * 100,
  size: seeded(i * 37.719 + 2) * 1.6 + 1,
  delay: seeded(i * 4.671 + 3) * 6,
  duration: seeded(i * 9.123 + 4) * 3 + 4,
}));

// A one-page "heavenly" palette -- a light, warm alternative to the
// site's dark default, scoped to just this landing page the same way a
// Skin scopes its palette to the Hub (see lib/skins.ts). Every element
// below already reads its colors through var(--void)/var(--gold)/etc.,
// so overriding these on the page's own root is enough to relight the
// whole page without touching app/globals.css or any other route.
const HEAVENLY_VARS = {
  "--void": "#fdfbf5",
  "--panel": "#ffffff",
  "--ink": "#2e2a45",
  "--ink-dim": "#6f6a85",
  "--ink-faint": "#a29cb0",
  "--gold": "#b8863f",
  "--rose": "#c9576a",
  "--border": "#ece6d8",
};

export default function Home() {
  const chimeRef = useRef<HTMLAudioElement>(null);

  function playChime() {
    const a = chimeRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {
      /* autoplay can be blocked before any interaction -- silently ignore */
    });
  }

  return (
    <main
      style={{
        ...(HEAVENLY_VARS as React.CSSProperties),
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(201,161,90,0.14), transparent 65%), var(--void)",
      }}
    >
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: .15; }
          50%      { opacity: .95; }
        }
        .stars {
          position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
        }
        .stars span {
          position: absolute; border-radius: 50%;
          background: var(--gold);
          animation: twinkle ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .stars span { animation: none; opacity: .35; }
        }

        @keyframes heartbeatGlow {
          0%   { text-shadow: 0 0 16px rgba(201,161,90,0.4), 0 0 40px rgba(201,161,90,0.18); transform: scale(1); }
          14%  { text-shadow: 0 0 30px rgba(201,161,90,0.7), 0 0 70px rgba(201,161,90,0.35); transform: scale(1.035); }
          28%  { text-shadow: 0 0 14px rgba(201,161,90,0.4), 0 0 34px rgba(201,161,90,0.16); transform: scale(1); }
          42%  { text-shadow: 0 0 24px rgba(201,161,90,0.55), 0 0 55px rgba(201,161,90,0.25); transform: scale(1.02); }
          65%  { text-shadow: 0 0 10px rgba(201,161,90,0.3), 0 0 26px rgba(201,161,90,0.12); transform: scale(1); }
          100% { text-shadow: 0 0 10px rgba(201,161,90,0.3), 0 0 26px rgba(201,161,90,0.12); transform: scale(1); }
        }
        .frequency-cta {
          display: inline-block;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: clamp(2rem, 7.5vw, 4.1rem);
          letter-spacing: 0.02em;
          line-height: 1.05;
          text-transform: uppercase;
          color: var(--gold);
          text-decoration: none;
          animation: heartbeatGlow 2.8s ease-in-out infinite;
          transition: text-shadow 0.15s ease, transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .frequency-cta:hover,
        .frequency-cta:focus-visible {
          text-shadow: 0 0 30px rgba(201,161,90,0.8), 0 0 80px rgba(201,161,90,0.5), 0 0 130px rgba(201,161,90,0.25);
          transform: scale(1.04);
          animation-play-state: paused;
        }
        .frequency-cta:active {
          text-shadow: 0 0 40px rgba(201,161,90,0.95), 0 0 100px rgba(201,161,90,0.65);
          transform: scale(0.97);
        }
        @media (prefers-reduced-motion: reduce) {
          .frequency-cta { animation: none; }
        }

        .merch-cta {
          display: inline-block;
          padding: 10px 22px;
          border: 1px solid rgba(201,161,90,0.5);
          border-radius: 999px;
          color: var(--gold);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
        }
        .merch-cta:hover,
        .merch-cta:focus-visible {
          border-color: var(--gold);
          background: rgba(201,161,90,0.08);
          transform: scale(1.03);
        }
      `}</style>

      <div className="stars" aria-hidden="true">
        {STARS.map((s, i) => (
          <span
            key={i}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "11px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--gold)",
            marginBottom: "20px",
          }}
        >
          Same Heart&trade; &middot; First Signal
        </p>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            fontSize: "1.02rem",
            margin: "0 0 26px",
          }}
        >
          Something is arriving.
        </p>

        <Link
          href="/login"
          className="frequency-cta"
          onClick={playChime}
          onTouchStart={() => {}}
        >
          Find Your Frequency
        </Link>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-faint, #5c6684)",
            margin: "18px 0 30px",
          }}
        >
          Touch to tune in
        </p>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            maxWidth: "44ch",
            fontSize: "0.95rem",
            margin: "0 0 8px",
          }}
        >
          SAMEHEART is opening its doors soon. Quiet from the outside &mdash;
          a whole universe once you&rsquo;re in.
        </p>

        <Link href="/shop" className="merch-cta" style={{ marginTop: "4px" }}>
          Visit the Merch Ship
        </Link>

        {/* Collapsed by default -- nothing shows until someone clicks it.
            Replace with a real waitlist write to Supabase later if wanted
            (see the "profiles" table in supabase/schema.sql). */}
        <details style={{ marginTop: "22px" }}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--ink-faint, #5c6684)",
            }}
          >
            Or leave your email
          </summary>
          <form
            style={{
              marginTop: "14px",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <input
              type="email"
              placeholder="your@email.com"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "999px",
                padding: "9px 14px",
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
                fontSize: "0.85rem",
                minWidth: "200px",
              }}
            />
            <button
              type="submit"
              style={{
                background: "none",
                border: "1px solid var(--gold)",
                borderRadius: "999px",
                padding: "9px 16px",
                color: "var(--gold)",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Notify me
            </button>
          </form>
        </details>
      </div>

      {/* Plays a soft heartbeat chime on tap/click -- browsers only allow
          this because it's triggered by a real user gesture, not on load. */}
      <audio ref={chimeRef} src="/heartbeat.wav" preload="auto" />

      <footer
        style={{
          position: "absolute",
          bottom: "16px",
          left: 0,
          right: 0,
          zIndex: 1,
          display: "flex",
          justifyContent: "center",
          gap: "16px",
        }}
      >
        {[
          { href: "/privacy", label: "Privacy" },
          { href: "/terms", label: "Terms" },
          { href: "/contact", label: "Contact" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              color: "var(--ink-faint, #5c6684)",
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            {link.label}
          </Link>
        ))}
      </footer>
    </main>
  );
}