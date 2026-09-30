"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import ProgressionSummary from "@/components/ProgressionSummary";
import { listMyKeys, evaluateKeys, KEY_INFO, type ProfileKey, type KeyColor } from "@/lib/keys";
import { CARDS, CARDS_MIN_LEVEL, cardUnlockId } from "@/lib/cards";
import { getLevel } from "@/lib/levels";
import { evaluateEvolution, listMyUnlocks } from "@/lib/evolution";

const ACCENT = "#e0703a";
const TOTAL_KEY_COLORS = Object.keys(KEY_INFO).length;

// The Wallet -- "everything you'll ever collect," for real, replacing the
// Coming Soon placeholder. Two of the three things that placeholder
// promised already have real data behind them, just never shown in one
// place before now: Heartbeats/Level/Standing (ProgressionSummary,
// already built for /cards) and Heart Strings (lib/keys.ts, so far only
// ever shown as a silent inline row on the Hub). Cards themselves
// already have a full, real collection page at /cards -- this doesn't
// duplicate that grid, it fronts it with a count and a real link, same
// as Deep Signals fronts its own catalog. "Gifts you can send to other
// people" is real still-undesigned work (no recipient picker exists
// anywhere yet, only a code-redemption system) -- named honestly below
// rather than quietly dropped, same tone as ComingSoon elsewhere.
export default function WalletPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [keys, setKeys] = useState<ProfileKey[]>([]);
  const [level, setLevel] = useState(0);
  const [cardsOwned, setCardsOwned] = useState(0);

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
      setCardsOwned(CARDS.filter((c) => unlockedIds.includes(cardUnlockId(c.id))).length);
      setChecking(false);
    })();
  }, [router]);

  if (checking) return <PageLoading />;

  // Keys stay silent about what's not yet held (same rule the Hub
  // already follows, see lib/evolution.ts's own comment on this) -- only
  // the ones actually earned get named and shown; everything else is
  // just a bare count.
  const KEY_ORDER = Object.keys(KEY_INFO) as KeyColor[];
  const orderedKeys = keys
    .slice()
    .sort((a, b) => KEY_ORDER.indexOf(a.key_color) - KEY_ORDER.indexOf(b.key_color));

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 90px",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
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

        <section style={{ marginBottom: "34px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", margin: 0 }}>
              Heart Strings
            </h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", color: "var(--ink-faint, #5c6684)" }}>
              {orderedKeys.length} of {TOTAL_KEY_COLORS} held
            </span>
          </div>

          {orderedKeys.length === 0 ? (
            <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.88rem", color: "var(--ink-dim)", margin: 0 }}>
              None yet -- Heart Strings are earned quietly through real activity across the
              site. The first one will show up here the moment it&rsquo;s yours.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {orderedKeys.map((k) => {
                const info = KEY_INFO[k.key_color];
                if (!info) return null;
                return (
                  <div
                    key={k.key_color}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: "16px",
                        height: "16px",
                        flexShrink: 0,
                        borderRadius: "50%",
                        background: info.accent,
                        boxShadow: `0 0 10px ${info.accent}99`,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem" }}>
                        {info.name}
                      </p>
                      <p style={{ margin: "2px 0 0", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.78rem", color: "var(--ink-dim)" }}>
                        {info.blurb}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ marginBottom: "34px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", margin: 0 }}>
              Cards
            </h2>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", color: "var(--ink-faint, #5c6684)" }}>
              {cardsOwned} of {CARDS.length} collected
            </span>
          </div>

          {level < CARDS_MIN_LEVEL ? (
            <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.88rem", color: "var(--ink-dim)", margin: "0 0 12px" }}>
              Cards begin at Level {CARDS_MIN_LEVEL}. You&rsquo;re Level {level} -- anything you&rsquo;ve
              already earned, like a Heart String, will be waiting for you when you get there.
            </p>
          ) : (
            <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.88rem", color: "var(--ink-dim)", margin: "0 0 12px" }}>
              Earned by leveling up, earning Heart Strings, and being here for special moments.
            </p>
          )}

          <Link
            href="/cards"
            style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--gold)", textDecoration: "none" }}
          >
            View your full Cards collection &rarr;
          </Link>
        </section>

        <section
          style={{
            padding: "16px 18px",
            borderRadius: "14px",
            background: "var(--panel)",
            border: "1px dashed var(--border)",
          }}
        >
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)" }}>
            Coming soon
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
