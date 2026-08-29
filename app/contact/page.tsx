import Link from "next/link";

export const metadata = {
  title: "Contact — Same Heart",
  description: "Get in touch with Same Heart Inc.",
};

export default function ContactPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "56px 22px 80px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: "520px", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mark.png"
          alt="Same Heart"
          style={{ width: "56px", height: "auto", marginBottom: "22px" }}
        />

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.8rem",
            margin: "0 0 14px",
          }}
        >
          Get in touch
        </h1>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            fontSize: "1rem",
            lineHeight: 1.7,
            margin: "0 0 28px",
          }}
        >
          Questions, order issues, press, or just want to say hello &mdash; we&rsquo;d like to
          hear from you.
        </p>

        <a
          href="mailto:sameheartinc@gmail.com"
          style={{
            display: "inline-block",
            padding: "12px 26px",
            border: "1px solid var(--gold)",
            borderRadius: "999px",
            color: "var(--gold)",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "0.95rem",
            textDecoration: "none",
          }}
        >
          sameheartinc@gmail.com
        </a>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-faint, #5c6684)",
            margin: "32px 0 0",
          }}
        >
          Same Heart Inc. &middot; Ontario, Canada
        </p>

        <p style={{ marginTop: "26px" }}>
          <Link
            href="/"
            style={{
              color: "var(--ink-dim)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "2px",
            }}
          >
            &larr; Back to Same Heart
          </Link>
        </p>
      </div>
    </main>
  );
}
