import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        background:
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,161,90,0.12), transparent 60%), var(--void)",
      }}
    >
      {/* Pure CSS heartbeat pulse -- no image needed. Two quick beats,
          then a rest, looping, matching the brand's heartbeat motif. */}
      <style>{`
        @keyframes heartbeatPulse {
          0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(201,161,90,0.55); }
          14%  { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(201,161,90,0.22); }
          28%  { transform: scale(1);    box-shadow: 0 0 0 0 rgba(201,161,90,0.35); }
          42%  { transform: scale(1.04); box-shadow: 0 0 0 4px rgba(201,161,90,0.15); }
          65%  { transform: scale(1);    box-shadow: 0 0 0 0 rgba(201,161,90,0); }
          100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(201,161,90,0); }
        }
        .frequency-cta {
          animation: heartbeatPulse 2.6s ease-in-out infinite;
        }
        .frequency-cta:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .frequency-cta { animation: none; }
        }
      `}</style>

      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "11px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--gold)",
          marginBottom: "18px",
        }}
      >
        Same Heart&trade; &middot; First Signal
      </p>

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
          margin: 0,
        }}
      >
        Something is arriving.
      </h1>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontStyle: "italic",
          color: "var(--ink-dim)",
          maxWidth: "48ch",
          marginTop: "18px",
          fontSize: "1.1rem",
        }}
      >
        SAMEHEART is opening its doors soon. Quiet from the outside &mdash;
        a whole universe once you&rsquo;re in.
      </p>

      <Link
        href="/login"
        className="frequency-cta"
        style={{
          marginTop: "38px",
          display: "inline-block",
          background: "linear-gradient(135deg, var(--gold), #e7c988)",
          color: "var(--void)",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "1.05rem",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          padding: "17px 36px",
          borderRadius: "999px",
          textDecoration: "none",
        }}
      >
        Find Your Frequency &rarr;
      </Link>

      {/* Collapsed by default -- nothing shows until someone clicks it.
          Replace with a real waitlist write to Supabase later if wanted
          (see the "profiles" table in supabase/schema.sql). */}
      <details style={{ marginTop: "30px" }}>
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
              border: "1px solid #313f5e",
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
    </main>
  );
}