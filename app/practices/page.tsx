"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import { getLevel } from "@/lib/primeLevels";
import {
  PRACTICE_ORDER,
  PRACTICES,
  EMPTY_PRACTICE_POINTS,
  normalizePracticePoints,
  investRipplePoint,
  practiceTier,
  practiceTierText,
  unspentRipplePoints,
  type PracticeKey,
  type PracticePoints,
} from "@/lib/practices";

// Practice Paths -- Rob, Sep 15 2026: "how does someone know what they
// get when they go from tier 2 to tier 3 in the blink of an eye
// spending their credit... you cant get there unless you have spent
// that many credits... theres gotta be a way where you can see the
// branches and why you would want to spend the point on guidance
// rather than kinship or voice."
//
// The Hub's own Practices panel (app/hub/page.tsx) only ever shows the
// tier you're currently on -- nothing about what's one point away, or
// five, or what any *other* Practice offers at the same distance. This
// page is the actual answer: all four Practices, side by side, every
// tier visible end to end, so the choice of where to spend a Ripple
// Point is an informed one instead of a blind click. The tiers
// themselves are strictly linear within a Practice (Tier N always
// needs exactly N points in that one Practice -- there's no branching
// *within* a path), so the real "branch" is which of the four parallel
// ladders a point goes into, not a tree inside any one of them --
// that's the shape this page draws.
//
// Honest about the other half of Rob's question too: only Tiers 1-4 of
// every Practice are real, shipped features today (see each
// PracticeDef's builtThrough in lib/practices.ts) -- everything past
// that is designed and worth planning around, but isn't a functional
// unlock yet. Every tier past builtThrough says so plainly rather than
// implying it already does something.
const TIERS_SHOWN = 20;

export default function PracticesPathsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [points, setPoints] = useState<PracticePoints>(EMPTY_PRACTICE_POINTS);
  const [investing, setInvesting] = useState<PracticeKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentRefs = useRef<Partial<Record<PracticeKey, HTMLDivElement | null>>>({});

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setUserId(userData.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("xp, practice_points")
        .eq("id", userData.user.id)
        .single();
      setXp((data as { xp: number } | null)?.xp ?? 0);
      setPoints(normalizePracticePoints((data as { practice_points: unknown } | null)?.practice_points));
      setChecking(false);
    })();
  }, [router]);

  // Land on your own current tier in each column, not Tier 1 -- the
  // point of this page is seeing what's ahead of where you are, not
  // re-reading what you've already unlocked.
  useEffect(() => {
    if (checking) return;
    for (const key of PRACTICE_ORDER) {
      currentRefs.current[key]?.scrollIntoView({ block: "center" });
    }
  }, [checking]);

  async function invest(key: PracticeKey) {
    if (investing) return;
    setInvesting(key);
    setError(null);
    const result = await investRipplePoint(key);
    setInvesting(null);
    if (!result.ok || !result.points) {
      setError(result.error ?? "Couldn't invest that point right now.");
      return;
    }
    setPoints(result.points);
  }

  if (checking || !userId) return <PageLoading />;

  const level = getLevel(xp);
  const unspent = unspentRipplePoints(level, points);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "40px 20px 80px",
      }}
    >
      <style>{`
        .practice-paths-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .practice-paths-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .practice-paths-grid { grid-template-columns: 1fr; }
        }
        .practice-tier-list::-webkit-scrollbar { width: 6px; }
        .practice-tier-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>

      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <Link
          href="/hub"
          style={{ color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: "0.8rem", textDecoration: "none" }}
        >
          &larr; Back to your Hub
        </Link>

        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.7rem", margin: "14px 0 8px" }}>
          Practice Paths
        </h1>
        <p style={{ color: "var(--ink-dim)", fontFamily: "var(--font-body)", fontSize: "0.95rem", maxWidth: "62ch", margin: "0 0 6px" }}>
          Every tier of every Practice, laid out end to end. A Ripple Point can go into any one of these four --
          see what's actually ahead before you spend it, not just what you already have.
        </p>
        <p style={{ color: "var(--ink-faint)", fontFamily: "var(--font-mono)", fontSize: "0.78rem", margin: "0 0 26px" }}>
          Level {level} &middot; {unspent} unspent Ripple Point{unspent === 1 ? "" : "s"}
        </p>

        {error && (
          <p style={{ color: "var(--rose)", fontSize: "0.85rem", marginBottom: "18px" }}>{error}</p>
        )}

        <div className="practice-paths-grid">
          {PRACTICE_ORDER.map((key) => {
            const def = PRACTICES[key];
            const tier = practiceTier(points, key);

            return (
              <div
                key={key}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  background: "var(--panel)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "16px 16px 12px" }}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", margin: "0 0 3px" }}>
                    {def.name}
                  </h2>
                  <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--ink-dim)" }}>
                    {def.theme}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink)" }}>
                      {tier > 0 ? `Tier ${tier}` : "Not started"}
                    </span>
                    {unspent > 0 && (
                      <button
                        onClick={() => invest(key)}
                        disabled={investing !== null}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "999px",
                          border: "1px solid var(--gold)",
                          background: "none",
                          color: "var(--gold)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "9px",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          cursor: investing !== null ? "default" : "pointer",
                          opacity: investing !== null ? 0.6 : 1,
                        }}
                      >
                        {investing === key ? "…" : `Invest → Tier ${tier + 1}`}
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="practice-tier-list"
                  style={{
                    borderTop: "1px solid var(--border)",
                    maxHeight: "560px",
                    overflowY: "auto",
                    padding: "8px",
                  }}
                >
                  {Array.from({ length: TIERS_SHOWN }, (_, i) => i + 1).map((tierNum) => {
                    const reached = tierNum <= tier;
                    const isCurrent = tierNum === tier;
                    const isNext = tierNum === tier + 1;
                    const built = tierNum <= def.builtThrough;
                    const pointsAway = tierNum - tier;

                    return (
                      <div
                        key={tierNum}
                        ref={isCurrent ? (el) => { currentRefs.current[key] = el; } : undefined}
                        style={{
                          padding: "9px 10px",
                          marginBottom: "4px",
                          borderRadius: "8px",
                          background: isCurrent ? "var(--gold)22" : "transparent",
                          border: isCurrent ? "1px solid var(--gold)" : "1px solid transparent",
                          opacity: reached ? 1 : isNext ? 0.95 : 0.6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", marginBottom: "2px" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "9px",
                              letterSpacing: "0.05em",
                              color: reached ? "var(--gold)" : "var(--ink-faint)",
                            }}
                          >
                            {reached ? "✓ " : ""}TIER {tierNum}
                          </span>
                          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            {!built && (
                              <span
                                title="Designed, not a live feature yet"
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "7px",
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  color: "var(--ink-faint)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "4px",
                                  padding: "1px 4px",
                                }}
                              >
                                Coming later
                              </span>
                            )}
                            {!reached && (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--ink-faint)" }}>
                                {pointsAway} pt{pointsAway === 1 ? "" : "s"} away
                              </span>
                            )}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: "var(--font-body)",
                            fontSize: "0.82rem",
                            lineHeight: 1.5,
                            color: reached ? "var(--ink)" : "var(--ink-dim)",
                          }}
                        >
                          {practiceTierText(key, tierNum)}
                        </p>
                      </div>
                    );
                  })}
                  <p
                    style={{
                      margin: "6px 4px 2px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      color: "var(--ink-faint)",
                      textAlign: "center",
                    }}
                  >
                    Continues past Tier {TIERS_SHOWN}, procedurally.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
