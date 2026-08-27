"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function GuidePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) return null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        padding: "48px 22px 80px",
        color: "var(--ink)",
      }}
    >
      <div style={{ maxWidth: "620px", margin: "0 auto" }}>
        <Link
          href="/galaxy"
          style={{
            display: "inline-block",
            marginBottom: "30px",
            color: "var(--gold)",
            fontFamily: "var(--font-display)",
            fontSize: "0.82rem",
            textDecoration: "none",
          }}
        >
          &larr; Back to the Galaxy
        </Link>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#7fd9c4",
            margin: "0 0 8px",
          }}
        >
          Field Guide
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "2rem",
            margin: "0 0 34px",
          }}
        >
          How it all works
        </h1>

        <div
          style={{
            marginBottom: "40px",
            padding: "20px 22px",
            borderLeft: "2px solid var(--gold)",
            background: "var(--panel)",
            borderRadius: "0 14px 14px 0",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.15rem",
              margin: "0 0 12px",
              color: "var(--ink)",
            }}
          >
            Why Same Heart exists
          </h2>
          <p
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--ink)",
              fontSize: "0.97rem",
              lineHeight: 1.75,
              margin: "0 0 14px",
            }}
          >
            The real answer, no corporate softening: we want to change
            how life feels for people, at real scale -- not thousands,
            billions. Courage is showing your heart even when you're
            scared, and this whole site is built on that one idea because
            we believe it's the actual lever. More heart in the things
            that matter -- quality of life, real humanity, how people
            treat each other and themselves -- and a lot less patience
            for the practices that have gone unquestioned for too long,
            the ones that quietly wear people down instead of lifting
            them up. Those are worth upending, deliberately, in a way
            that leaves things better than it found them.
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              color: "var(--ink-dim)",
              fontSize: "0.92rem",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            Everything else on this site -- your Star Day, your Spark ID,
            the Commons, the Merch Ship -- exists to serve that, not the
            other way around. What you're using today is an early,
            honest first version of a much bigger intention. We're not
            pretending otherwise, and we're not slowing down either.
          </p>
        </div>

        <Section title="Star Day">
          Entered once, right after you arrive, and never asked for again.
          Your birth date runs through a fixed formula that always produces
          the same result for that date -- a frequency (like{" "}
          <em>612.4Hz</em>), an archetype (like <em>The Bloom Signal</em>),
          and a designation (like <em>SH-0524&middot;94</em>). It's
          permanent because it's meant to describe something true about
          when you showed up, not a setting you'd want to change later.
        </Section>

        <Section title="Path">
          A much quicker read, assigned the moment you first arrive --
          three short picks plus a few seconds of how your mouse actually
          moves, blended together into one of four paths: Guardian,
          Seeker, Weaver, or Flame. Where Star Day is the deep, permanent
          signal, Path is more like a mood -- it colors the arrival
          sequence and shows on your profile, but it isn't meant to be a
          verdict on who you are.
        </Section>

        <Section title="Spark ID">
          A quiet, permanent member number -- shown as{" "}
          <em>Spark #00042</em> -- stamped the instant your account is
          created and never reassigned, even if you later add an email to
          it. It's just proof of when you showed up, nothing more.
        </Section>

        <Section title="Standing & XP">
          Both show up in your Hub already. Being straightforward about
          where things actually stand: the specific actions that grow
          them are still being built, so right now they mostly just
          exist, waiting for that to catch up. Once real ways to earn XP
          exist, this section gets rewritten with the specifics --
          nothing here is final, and nothing about money will ever change
          your Standing. Money can buy expression -- a skin, a piece of
          merch -- never standing.
        </Section>

        <Section title="Skins">
          Purely how your Hub looks to you. Switching skins never touches
          Standing, XP, or anything else about your account -- it's the
          one thing here that's entirely, harmlessly yours to change as
          often as you want.
        </Section>

        <Section title="Your log">
          The one place in the Hub you write into yourself. Drop a
          thought, a win, a dream, anything -- it's private to you,
          timestamped, and stays exactly as you wrote it. There's no
          wrong way to use it.
        </Section>

        <Section title="Anonymous vs. claimed accounts">
          Arriving doesn't require an email -- you get a real, working
          account instantly. The trade-off: an account like that only
          lives on the one device and browser you created it on. If you
          clear your browser data or lose the device, it's genuinely
          gone, with no way back in. "Claim your account" (a banner in
          your Hub) adds an email and password to that same account --
          nothing about it changes or moves, it just becomes recoverable
          on another device.
        </Section>

        <Section title="The legal stuff">
          Same Heart is a real, incorporated business (Same Heart Inc.,
          Ontario), and SAMEHEART&trade; has a trademark application on
          file. A proper Terms of Service and Privacy Policy -- reviewed
          by an actual lawyer, not drafted informally -- are still being
          finalized and aren't published yet. Treat this page as an
          honest explanation of how the site works today, not a legal
          document.
        </Section>

        <p
          style={{
            marginTop: "40px",
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            fontSize: "0.9rem",
          }}
        >
          This page will keep changing as the site does. If something
          here stops being true, that's a bug -- not a secret.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "30px" }}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "1.05rem",
          margin: "0 0 10px",
          color: "var(--gold)",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--ink)",
          fontSize: "0.95rem",
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {children}
      </p>
    </section>
  );
}
