"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import CollectibleCard from "@/components/CollectibleCard";
import { CARDS, CARDS_MIN_LEVEL, cardUnlockId, type CardDef } from "@/lib/cards";
import { getLevel } from "@/lib/primeLevels";
import { evaluateEvolution, listMyUnlocks } from "@/lib/evolution";

// The Cards collection -- see lib/cards.ts. Runs the Evolution check on
// arrival so a card earned a moment ago (a level crossed, a Heart String
// just granted) is already in the collection when the page opens, then
// shows the whole catalog: cards you hold, and the rest dimmed with how
// to earn them. Ownership only ever comes from profile_unlocks, which
// nothing but the server can write.
export default function CardsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      await evaluateEvolution();
      const { data: profileRow } = await supabase.from("profiles").select("xp").eq("id", userData.user.id).single();
      setLevel(getLevel(profileRow?.xp ?? 0));
      setOwned(new Set(await listMyUnlocks()));
      setChecking(false);
    })();
  }, [router]);

  if (checking) return <PageLoading />;

  const isOwned = (card: CardDef) => owned.has(cardUnlockId(card.id));
  const collected = CARDS.filter(isOwned).length;
  const sections: { title: string; cards: CardDef[] }[] = [
    { title: "Levels", cards: CARDS.filter((c) => c.source.type === "level") },
    { title: "Heart Strings", cards: CARDS.filter((c) => c.source.type === "heart-string") },
    { title: "Events", cards: CARDS.filter((c) => c.source.type === "event") },
  ].filter((s) => s.cards.length > 0);

  return (
    <main style={{ minHeight: "100vh", background: "var(--void)", color: "var(--ink)", padding: "48px 22px 90px" }}>
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        <Link
          href="/hub"
          style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.82rem", textDecoration: "none" }}
        >
          &larr; Back to the Hub
        </Link>

        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.6rem", margin: "20px 0 4px" }}>
          Cards
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)", margin: "0 0 8px" }}>
          {collected} of {CARDS.length} collected
        </p>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--ink-dim)", maxWidth: "56ch", margin: "0 0 18px" }}>
          Earned by leveling up, earning Heart Strings, and being here for special moments. Once a card is
          yours, it stays yours.
        </p>
        {level < CARDS_MIN_LEVEL && (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.05em",
              color: "var(--gold)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "10px 14px",
              maxWidth: "56ch",
              margin: "0 0 28px",
            }}
          >
            Cards begin at Level {CARDS_MIN_LEVEL}. You&rsquo;re Level {level} &mdash; {CARDS_MIN_LEVEL - level}{" "}
            to go. Anything you&rsquo;ve already earned, like a Heart String, will be waiting for you when you
            get there.
          </p>
        )}
        {level >= CARDS_MIN_LEVEL && <div style={{ marginBottom: "28px" }} />}

        {sections.map((section) => (
          <section key={section.title} style={{ marginBottom: "34px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", margin: "0 0 12px" }}>
              {section.title}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "14px" }}>
              {section.cards.map((card) => (
                <CollectibleCard key={card.id} card={card} owned={isOwned(card)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
