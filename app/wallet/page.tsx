"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import ProgressionSummary from "@/components/ProgressionSummary";
import WorldField from "@/components/WorldField";
import CollectibleCard from "@/components/CollectibleCard";
import { ONBOARDING_WORLD } from "@/lib/worlds";
import { listMyKeys, evaluateKeys, KEY_INFO, type ProfileKey, type KeyColor } from "@/lib/keys";
import { CARDS, CARDS_MIN_LEVEL, cardUnlockId } from "@/lib/cards";
import { getLevel } from "@/lib/levels";
import { evaluateEvolution, listMyUnlocks } from "@/lib/evolution";

const ACCENT = "#e0703a";
const TOTAL_KEY_COLORS = Object.keys(KEY_INFO).length;
// How many card tiles the preview shelf shows at most -- a taste of the
// real vault, not a second copy of it (the full grid lives at /cards).
const CARD_PREVIEW_MAX = 6;

// The Wallet -- "everything you'll ever collect," for real, replacing the
// Coming Soon placeholder. Two of the three things that placeholder
// promised already have real data behind them, just never shown in one
// place before now: Heartbeats/Level/Standing/Streak (ProgressionSummary,
// already built for /cards) and Heart Strings (lib/keys.ts, so far only
// ever shown as a silent inline row on the Hub). Cards themselves
// already have a full, real collection page at /cards -- this doesn't
// duplicate that grid, it fronts it with a real shelf of actual tiles
// (reusing CollectibleCard exactly, not a re-skinned copy) and a link.
// "Gifts you can send to other people" is real, undesigned work -- named
// honestly below rather than quietly dropped.
//
// Rob, Sep 30 2026, after the first plain-list version: "this has to
// feel more digital...like a digital locker room filled with cool
// hidden gems, unlockables, trophies." Rebuilt around that -- the same
// WorldField starfield Galaxy and Login use as a living backdrop, Heart
// Strings as glowing trophy medallions instead of list rows, and real
// Card tiles standing in for "hidden gems" rather than describing them
// in a sentence.
export default function WalletPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [keys, setKeys] = useState<ProfileKey[]>([]);
  const [level, setLevel] = useState(0);
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      // Same "recheck on arrival" pattern as /cards -- a key or card
      // earned a moment ago elsewhere on the site is already here when
      // this page opens, not stuck waiting for some other page to
      // trigger the check.
      await Promise.all([evaluateKeys(), evaluateEvolution()]);

      const [{ data: profileRow }, myKeys, unlockedIds] = await Promise.all([
        supabase.from("profiles").select("xp").eq("id", userData.user.id).single(),
        listMyKeys(),
        listMyUnlocks(),
      ]);

      setLevel(getLevel((profileRow as { xp: number } | null)?.xp ?? 0));
      setKeys(myKeys);
      setOwnedCardIds(new Set(unlockedIds));
      setChecking(false);
    })();
  }, [router]);

  if (checking) return <PageLoading />;

  // Keys stay silent about what's not yet held (same rule the Hub
  // already follows, see lib/evolution.ts's own comment on this) -- only
  // the ones actually earned get their own trophy tile; everything else
  // is just a bare count, never enumerated.
  const KEY_ORDER = Object.keys(KEY_INFO) as KeyColor[];
  const orderedKeys = keys
    .slice()
    .sort((a, b) => KEY_ORDER.indexOf(a.key_color) - KEY_ORDER.indexOf(b.key_color));

  const isOwned = (id: string) => ownedCardIds.has(cardUnlockId(id));
  const cardsOwned = CARDS.filter((c) => isOwned(c.id)).length;

  // The preview shelf: real owned cards first (the actual trophies), then
  // a couple of locked ones for "more to find" texture -- only once
  // Cards have actually begun (see CARDS_MIN_LEVEL), so nobody below
  // Level 50 sees a wall of locked cards for a system they haven't
  // reached yet.
  const ownedPreview = CARDS.filter((c) => isOwned(c.id)).slice(0, CARD_PREVIEW_MAX);
  // Fills whatever's left of the shelf with locked cards (real
  // describeCardSource() hints, not mystery blanks) -- a full shelf of
  // "things to go earn" when nothing's owned yet, just a couple of
  // teasers once most of the shelf is already real trophies.
  const lockedFillCount = Math.max(0, CARD_PREVIEW_MAX - ownedPreview.length);
  const previewCards =
    level < CARDS_MIN_LEVEL
      ? []
      : [...ownedPreview, ...CARDS.filter((c) => !isOwned(c.id)).slice(0, lockedFillCount)];

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        color: "var(--ink)",
        overflow: "hidden",
      }}
    >
      <WorldField world={ONBOARDING_WORLD} />

      <style>{`
        @keyframes walletMedallionGlow {
          0%, 100% { box-shadow: 0 0 10px var(--wallet-glow, rgba(224,112,58,0.5)); }
          50% { box-shadow: 0 0 20px var(--wallet-glow, rgba(224,112,58,0.5)); }
        }
        .wallet-medallion {
          animation: walletMedallionGlow 3.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .wallet-medallion { animation: none; }
        }
        .wallet-panel {
          position: relative;
          border-radius: 16px;
          background: rgba(13, 16, 28, 0.72);
          backdrop-filter: blur(6px);
          border: 1px solid var(--border);
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "720px", margin: "0 auto", padding: "48px 22px 90px" }}>
        <Link
          href="/galaxy"
          style={{
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
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: ACCENT,
            margin: "22px 0 8px",
            textShadow: `0 0 12px ${ACCENT}88`,
          }}
        >
          The Wallet
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.7rem", margin: "0 0 10px" }}>
          Everything you&rsquo;ve collected.
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            maxWidth: "56ch",
            margin: "0 0 26px",
          }}
        >
          Your Heartbeats, your Heart Strings, and every Card you&rsquo;ve earned -- permanent,
          never spent, always yours.
        </p>

        <ProgressionSummary />

        <section className="wallet-panel" style={{ padding: "20px 20px 22px", marginBottom: "24px" }}>
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
              Trophy Case &middot; Heart Strings
            </h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", color: "var(--ink-faint, #5c6684)" }}>
              {orderedKeys.length} of {TOTAL_KEY_COLORS} held
            </span>
          </div>

          {orderedKeys.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                aria-hidden="true"
                style={{
                  width: "56px",
                  height: "56px",
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: "1px dashed var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display)",
                  fontSize: "1.2rem",
                  color: "var(--ink-faint, #5c6684)",
                }}
              >
                &#128274;
              </div>
              <p style={{ margin: 0, fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
                Sealed for now -- Heart Strings are earned quietly through real activity across
                the site. The first one lights up here the moment it&rsquo;s yours.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "18px" }}>
              {orderedKeys.map((k) => {
                const info = KEY_INFO[k.key_color];
                if (!info) return null;
                return (
                  <div key={k.key_color} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "84px" }} title={info.blurb}>
                    <div
                      className="wallet-medallion"
                      aria-hidden="true"
                      style={{
                        width: "62px",
                        height: "62px",
                        borderRadius: "50%",
                        background: `radial-gradient(circle at 38% 32%, ${info.accent}, ${info.accent}33 72%)`,
                        border: `2px solid ${info.accent}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        ["--wallet-glow" as string]: `${info.accent}99`,
                      }}
                    >
                      <span style={{ fontSize: "1.3rem", filter: "drop-shadow(0 0 4px rgba(0,0,0,0.35))" }}>&#9829;</span>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "8.5px",
                        letterSpacing: "0.03em",
                        textAlign: "center",
                        color: "var(--ink-dim)",
                        lineHeight: 1.3,
                      }}
                    >
                      {info.name.replace(" Heart String", "")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="wallet-panel" style={{ padding: "20px 20px 22px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
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
              Hidden Gems &middot; Cards
            </h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", color: "var(--ink-faint, #5c6684)" }}>
              {cardsOwned} of {CARDS.length} collected
            </span>
          </div>

          {level < CARDS_MIN_LEVEL ? (
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "6px" }}>
              <div
                aria-hidden="true"
                style={{
                  width: "56px",
                  height: "56px",
                  flexShrink: 0,
                  borderRadius: "12px",
                  border: "1px dashed var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display)",
                  fontSize: "1.2rem",
                  color: "var(--ink-faint, #5c6684)",
                }}
              >
                &#128274;
              </div>
              <p style={{ margin: 0, fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
                The vault opens at Level {CARDS_MIN_LEVEL}. You&rsquo;re Level {level} -- anything
                you&rsquo;ve already earned, like a Heart String, will be waiting for you when you
                get there.
              </p>
            </div>
          ) : (
            <>
              <p style={{ margin: "0 0 14px", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
                Earned by leveling up, earning Heart Strings, and being here for special moments.
              </p>
              {previewCards.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                  {previewCards.map((card) => (
                    <CollectibleCard key={card.id} card={card} owned={isOwned(card.id)} />
                  ))}
                </div>
              )}
            </>
          )}

          <Link
            href="/cards"
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--gold)", textDecoration: "none" }}
          >
            Open the full vault &rarr;
          </Link>
        </section>

        <section
          className="wallet-panel"
          style={{
            padding: "16px 18px",
            borderStyle: "dashed",
          }}
        >
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)" }}>
            Locked &middot; Coming soon
          </p>
          <p style={{ margin: "6px 0 0", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
            Sending a gift straight from your Wallet to someone else&rsquo;s -- being designed for real,
            not built yet.
          </p>
        </section>
      </div>
    </main>
  );
}
