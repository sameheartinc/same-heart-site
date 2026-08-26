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

      {/* Replace this with a real waitlist form wired to Supabase once
          the "profiles" table (see supabase/schema.sql) is set up. */}
      <form
        style={{
          marginTop: "34px",
          display: "flex",
          gap: "10px",
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
            padding: "12px 18px",
            color: "var(--ink)",
            fontFamily: "var(--font-body)",
            minWidth: "240px",
          }}
        />
        <button
          type="submit"
          style={{
            background: "var(--gold)",
            border: "none",
            borderRadius: "999px",
            padding: "12px 22px",
            color: "var(--void)",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Notify me
        </button>
      </form>

      <Link
        href="/login"
        style={{
          marginTop: "22px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-faint, #5c6684)",
          textDecoration: "underline",
        }}
      >
        Find your frequency &rarr;
      </Link>
    </main>
  );
}
