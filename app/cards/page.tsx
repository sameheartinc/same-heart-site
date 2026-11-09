"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import CollectibleCard from "@/components/CollectibleCard";
import ProgressionSummary from "@/components/ProgressionSummary";
import WorldField from "@/components/WorldField";
import { ONBOARDING_WORLD } from "@/lib/worlds";
import { CARDS, CARDS_MIN_LEVEL, cardUnlockId, type CardDef } from "@/lib/cards";
import { getLevel } from "@/lib/levels";
import { evaluateEvolution, listMyUnlocks } from "@/lib/evolution";

// The Cards collection -- see lib/cards.ts. Runs the Evolution check on
// arrival so a card earned a moment ago (a level crossed, a Heart String
// just granted) is already in the collection when the page opens, then
// shows the whole catalog: cards you hold, and the rest dimmed with how
// to earn them. Ownership only ever comes from profile_unlocks, which
// nothing but the server can write.
//
// Visual language brought in line with /wallet's "aviation deck /
// command centre" pass (Sep 30 2026) -- same WorldField starfield
// backdrop, same blueprint grid, same clipped-corner panels with HUD
// brackets, since Wallet already calls this page "the full manifest"
// and the two should read as one place, not two different ones. Nothing
// about ownership, the fetch, or CollectibleCard's own data contract
// changed -- only the frame around it.
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
    // Unlike every other section, a card nobody can ever earn isn't a
    // goal worth showing locked -- it's tied to WHEN someone joined, not
    // something still ahead of them (see lib/cards.ts's NEW_MEMBER_CARD_
    // LAUNCH_MS). So this section only exists at all for people who
    // actually hold it; it quietly drops out otherwise, same as every
    // other empty section already does below.
    { title: "Welcome", cards: CARDS.filter((c) => c.source.type === "new-member" && isOwned(c)) },
    { title: "Levels", cards: CARDS.filter((c) => c.source.type === "level") },
    { title: "Heart Strings", cards: CARDS.filter((c) => c.source.type === "heart-string") },
    { title: "Events", cards: CARDS.filter((c) => c.source.type === "event") },
  ].filter((s) => s.cards.length > 0);

  return (
    <main style={{ position: "relative", minHeight: "100vh", color: "var(--ink)", overflow: "hidden" }}>
      <WorldField world={ONBOARDING_WORLD} />

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(201,161,90,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(201,161,90,0.05) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <style jsx>{`
        .command-panel {
          position: relative;
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
          background: linear-gradient(135deg, rgba(22, 26, 40, 0.88), rgba(9, 11, 18, 0.92));
          border: 1px solid rgba(201, 161, 90, 0.4);
          box-shadow: inset 0 0 0 1px rgba(201, 161, 90, 0.06), 0 0 22px rgba(201, 161, 90, 0.08);
        }
        .command-panel::before,
        .command-panel::after {
          content: "";
          position: absolute;
          width: 12px;
          height: 12px;
          border-color: var(--gold);
          border-style: solid;
          pointer-events: none;
        }
        .command-panel::before {
          top: -1px;
          left: -1px;
          border-width: 2px 0 0 2px;
        }
        .command-panel::after {
          bottom: -1px;
          right: -1px;
          border-width: 0 2px 2px 0;
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "860px", margin: "0 auto", padding: "48px 22px 90px" }}>
        <Link
          href="/hub"
          style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.82rem", textDecoration: "none" }}
        >
          &larr; Back to the Hub
        </Link>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--gold)",
            margin: "22px 0 8px",
          }}
        >
          Manifest
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.6rem", margin: "0 0 4px" }}>
          Cards
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-faint, #5c6684)",
            margin: "0 0 20px",
          }}
        >
          {collected} of {CARDS.length} logged
        </p>

        <ProgressionSummary />

        <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", maxWidth: "56ch", margin: "0 0 18px" }}>
          Earned by joining, leveling up, earning Heart Strings, and being here for special moments. Once a
          card is yours, it stays yours.
        </p>

        {level < CARDS_MIN_LEVEL && (
          <div
            className="command-panel"
            style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px", marginBottom: "28px" }}
          >
            <div
              aria-hidden="true"
              style={{
                width: "50px",
                height: "50px",
                flexShrink: 0,
                border: "1px dashed rgba(201,161,90,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.04em",
                color: "var(--ink-faint, #5c6684)",
              }}
            >
              LOCKED
            </div>
            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
              Clearance required: Level {CARDS_MIN_LEVEL}. You&rsquo;re Level {level} &mdash; {CARDS_MIN_LEVEL - level}{" "}
              to go. Anything you&rsquo;ve already earned, like a Heart String, will be waiting for you when you
              get there.
            </p>
          </div>
        )}
        {level >= CARDS_MIN_LEVEL && <div style={{ marginBottom: "28px" }} />}

        {sections.map((section) => {
          const sectionOwned = section.cards.filter(isOwned).length;
          return (
            <section key={section.title} className="command-panel" style={{ padding: "22px 24px 24px", marginBottom: "22px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                <h2
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--gold)",
                    margin: 0,
                  }}
                >
                  {section.title}
                </h2>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", color: "var(--ink-faint, #5c6684)" }}>
                  {sectionOwned} of {section.cards.length} logged
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "14px" }}>
                {section.cards.map((card) => (
                  <CollectibleCard key={card.id} card={card} owned={isOwned(card)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
