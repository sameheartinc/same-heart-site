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
// real manifest, not a second copy of it (the full grid lives at /cards).
const CARD_PREVIEW_MAX = 6;

// The Wallet -- "everything you'll ever collect," for real, replacing the
// Coming Soon placeholder. Two of the three things that placeholder
// promised already have real data behind them, just never shown in one
// place before now: Heartbeats/Level/Standing/Streak (ProgressionSummary,
// already built for /cards) and Heart Strings (lib/keys.ts, so far only
// ever shown as a silent inline row on the Hub). Cards themselves
// already have a full, real collection page at /cards -- this doesn't
// duplicate that grid, it fronts it with a real preview of actual tiles
// (reusing CollectibleCard exactly, not a re-skinned copy) and a link.
// "Gifts you can send to other people" is real, undesigned work -- named
// honestly below rather than quietly dropped.
//
// Visual language went through three passes with Rob before landing
// here (Sep 30 2026): "more digital...like a digital locker room" ->
// "more organic...like some garden you come to to find and store
// special unlockable cards" -> finally "more rectangular, almost like
// an aviation deck...it should feel like a command centre with all your
// unlockables." This build is that last one: angular clipped-corner
// panels (two corners cut at 45deg, the other two braced with HUD
// corner brackets), a faint blueprint grid behind everything, amber
// instrument-panel glow, and Heart Strings as small status modules
// instead of circles or blooms. Same WorldField starfield backdrop
// throughout all three passes -- this reads as a command deck
// overlooking that same sky, not a different place.
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
  // the ones actually earned get their own status module; everything
  // else is just a bare count, never enumerated.
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

      <style>{`
        /* Rob, Sep 30 2026 (third pass): "make the bubbles more
           rectangular and almost like a aviation deck...it should feel
           like a command centre with all your unlockables." Every panel
           clips two opposite corners at 45deg (an angular console-panel
           silhouette, no curves anywhere) and braces the other two with
           small HUD corner brackets. Status modules pulse like an
           active instrument light, not an organic breathing shape. */
        .wallet-panel {
          position: relative;
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
          background: linear-gradient(135deg, rgba(22,26,40,0.88), rgba(9,11,18,0.92));
          border: 1px solid rgba(201,161,90,0.4);
          box-shadow: inset 0 0 0 1px rgba(201,161,90,0.06), 0 0 22px rgba(201,161,90,0.08);
        }
        .wallet-panel::before,
        .wallet-panel::after {
          content: "";
          position: absolute;
          width: 12px;
          height: 12px;
          border-color: var(--gold);
          border-style: solid;
          pointer-events: none;
        }
        .wallet-panel::before { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .wallet-panel::after { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }

        @keyframes walletModulePulse {
          0%, 100% { box-shadow: 0 0 8px var(--wallet-glow, rgba(224,112,58,0.5)); }
          50% { box-shadow: 0 0 16px var(--wallet-glow, rgba(224,112,58,0.5)); }
        }
        .wallet-module {
          animation: walletModulePulse 2.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .wallet-module { animation: none; }
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
          Your own command deck -- every Heartbeat, Heart String, and Card you&rsquo;ve earned,
          logged and on display. A permanent record; nothing here is ever spent.
        </p>

        <ProgressionSummary />

        <section className="wallet-panel" style={{ padding: "22px 24px 24px", marginBottom: "22px" }}>
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
              Active &middot; Heart Strings
            </h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", color: "var(--ink-faint, #5c6684)" }}>
              {orderedKeys.length} of {TOTAL_KEY_COLORS} online
            </span>
          </div>

          {orderedKeys.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
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
                OFFLINE
              </div>
              <p style={{ margin: 0, fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
                Nothing online yet -- Heart Strings are earned quietly through real activity
                across the site. The first one lights up here the moment it&rsquo;s yours.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              {orderedKeys.map((k) => {
                const info = KEY_INFO[k.key_color];
                if (!info) return null;
                return (
                  <div key={k.key_color} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", width: "80px" }} title={info.blurb}>
                    <div
                      className="wallet-module"
                      aria-hidden="true"
                      style={{
                        width: "54px",
                        height: "54px",
                        clipPath: "polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px))",
                        background: `linear-gradient(135deg, ${info.accent}66, ${info.accent}1a)`,
                        border: `1px solid ${info.accent}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        ["--wallet-glow" as string]: `${info.accent}99`,
                      }}
                    >
                      <span style={{ fontSize: "1.15rem", filter: "drop-shadow(0 0 4px rgba(0,0,0,0.4))" }}>&#9829;</span>
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

        <section className="wallet-panel" style={{ padding: "22px 24px 24px", marginBottom: "22px" }}>
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
              Manifest &middot; Cards
            </h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", color: "var(--ink-faint, #5c6684)" }}>
              {cardsOwned} of {CARDS.length} logged
            </span>
          </div>

          {level < CARDS_MIN_LEVEL ? (
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "6px" }}>
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
                Clearance required: Level {CARDS_MIN_LEVEL}. You&rsquo;re Level {level} -- anything
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
            Open the full manifest &rarr;
          </Link>
        </section>

        <section
          className="wallet-panel"
          style={{
            padding: "16px 20px",
          }}
        >
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)" }}>
            Offline &middot; Coming soon
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
