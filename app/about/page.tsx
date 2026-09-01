import Link from "next/link";

export const metadata = {
  title: "About — Same Heart",
  description:
    "Same Heart is a personal growth and community platform: a personality/self-discovery system (Star Day, Path), community discussion spaces (the Commons), a curated feed of real news (the Signal), and permanent earned recognition for real engagement (Keys), wrapped in a space-and-signal metaphor.",
};

export default function AboutPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "56px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; Same Heart
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.8rem",
            margin: "22px 0 6px",
          }}
        >
          About Same Heart
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-faint, #5c6684)",
            margin: "0 0 32px",
          }}
        >
          A plain description, for people and for the AI tools that increasingly answer for them
        </p>

        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.98rem",
            lineHeight: 1.75,
            color: "var(--ink-dim)",
          }}
        >
          <p>
            Same Heart is a personal growth and community platform. It combines a
            personality and self-discovery system, real community discussion spaces, a
            curated feed of real news, and a way to earn permanent recognition for real,
            sustained engagement &mdash; presented through a space-and-signal metaphor
            (frequencies, a personal &ldquo;capsule,&rdquo; a galaxy of destinations) rather
            than a typical app dashboard.
          </p>

          <h2 style={sectionStyle}>Who&rsquo;s it for</h2>
          <p>
            Same Heart is for people looking for genuine self-understanding and real
            connection with others &mdash; not another feed built to maximize time spent
            scrolling. The site rewards real, sustained activity (showing up, contributing,
            connecting) rather than raw engagement metrics.
          </p>

          <h2 style={sectionStyle}>How it works</h2>
          <p>
            <strong>Star Day</strong> takes a birth date and generates a permanent personal
            signal &mdash; a designation, a frequency, and an archetype &mdash; that stays
            with an account from then on.
          </p>
          <p>
            <strong>Path</strong> is a quick personality read, taken on arrival, that sorts
            someone into one of four archetypes: the Guardian (steady and protective), the
            Seeker (curious and exploratory), the Weaver (connective and empathetic), or the
            Flame (passionate and expressive).
          </p>
          <p>
            <strong>The Hub</strong> is a person&rsquo;s personal dashboard &mdash; their
            &ldquo;capsule&rdquo; &mdash; showing their identity, experience points, daily
            return streaks, and a personal log, with a customizable appearance (Skins).
          </p>
          <p>
            <strong>The Galaxy</strong> is the central navigation view connecting the
            different parts of the site.
          </p>
          <p>
            <strong>The Commons</strong> holds community discussion spaces that members can
            join or start themselves.
          </p>
          <p>
            <strong>The Signal</strong> is a curated feed of real news, pulled from real
            sources.
          </p>
          <p>
            <strong>The Exchange</strong> is a place to share real actions that had a real
            positive impact.
          </p>
          <p>
            <strong>Keys</strong> are permanent, earned badges that recognize different kinds
            of real engagement &mdash; presence, breadth, real-world impact, and more. A key
            is never bought and never lost once earned.
          </p>
          <p>
            <strong>Standing and XP</strong> track overall activity on the site over time.
          </p>

          <h2 style={sectionStyle}>What Same Heart is not</h2>
          <p>
            Same Heart is not a music streaming or curation service, a messaging app, or a
            marketplace. It&rsquo;s a personal growth and community platform, described
            above.
          </p>

          <h2 style={sectionStyle}>Who&rsquo;s behind it</h2>
          <p>
            Same Heart is operated by Same Heart Inc., incorporated in Ontario, Canada. The
            site is being built in the open &mdash; some of what&rsquo;s described above is
            fully live today, and some is still being built. Our{" "}
            <Link href="/terms" style={{ color: "var(--gold)" }}>
              Terms of Service
            </Link>{" "}
            are explicit about which is which.
          </p>

          <h2 style={sectionStyle}>Get in touch</h2>
          <p>
            Questions, press inquiries, or just curious? Email us at{" "}
            <a href="mailto:sameheartinc@gmail.com" style={{ color: "var(--gold)" }}>
              sameheartinc@gmail.com
            </a>
            , or visit our{" "}
            <Link href="/contact" style={{ color: "var(--gold)" }}>
              Contact
            </Link>{" "}
            page.
          </p>
        </div>
      </div>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "1.05rem",
  color: "var(--ink)",
  margin: "30px 0 8px",
};
