"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSkin } from "@/lib/skins";
import PageLoading from "@/components/PageLoading";
import {
  authorName,
  createReply,
  fetchProfilesByIds,
  fetchReactionSummaries,
  flagContent,
  getThread,
  hasFlagged,
  listReplies,
  setReaction,
  touchPresence,
  type CommonsReply,
  type CommonsThread,
  type PublicProfile,
  type ReactionKind,
  type ReactionSummary,
  type ReactionTargetType,
} from "@/lib/commons";
import { EMPTY_PRACTICE_POINTS, normalizePracticePoints, practiceTier, type PracticePoints } from "@/lib/practices";

const ACCENT = "#c9576a";
const EMPTY_SUMMARY: ReactionSummary = { heartfelt: 0, heartache: 0, mine: null };

export default function ThreadPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [mySkin, setMySkin] = useState(getSkin(null));
  const [thread, setThread] = useState<CommonsThread | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [replies, setReplies] = useState<CommonsReply[]>([]);
  const [authors, setAuthors] = useState<Record<string, PublicProfile>>({});
  const [reactions, setReactions] = useState<Record<string, ReactionSummary>>({});
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stewardship Tier 1 -- flagging a thread or reply (see
  // lib/practices.ts). Gated on invested Stewardship points; flaggedMap
  // greys out a Flag button already used, same shape as reactions above.
  const [myPracticePoints, setMyPracticePoints] = useState<PracticePoints>(EMPTY_PRACTICE_POINTS);
  const stewardshipTier = practiceTier(myPracticePoints, "stewardship");
  const [flaggedMap, setFlaggedMap] = useState<Record<string, boolean>>({});
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      touchPresence(data.user.id); // fire-and-forget -- don't block the first paint on this
      // Same Skin as the Hub and the Commons home -- see
      // app/commons/page.tsx. Also pulls practice_points here, so the
      // Flag button below only shows for someone who's actually
      // unlocked Stewardship Tier 1 (see lib/practices.ts).
      supabase
        .from("profiles")
        .select("ship_skin, practice_points")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profileRow }) => {
          if (profileRow?.ship_skin) setMySkin(getSkin(profileRow.ship_skin));
          setMyPracticePoints(normalizePracticePoints(profileRow?.practice_points));
        });
      await load(data.user.id);
      setChecking(false);
    })();
  }, [router, params.id]);

  async function load(uid?: string | null) {
    const effectiveUid = uid !== undefined ? uid : userId;
    const t = await getThread(params.id);
    if (!t) {
      setNotFound(true);
      return;
    }
    setThread(t);
    const r = await listReplies(params.id);
    setReplies(r);
    setAuthors(await fetchProfilesByIds([t.profile_id, ...r.map((rep) => rep.profile_id)]));
    // Heartfelt/Heartache -- one fetch for the thread itself, one for every
    // reply, merged into a single lookup by id (thread and reply ids never
    // collide, so this is safe). See lib/commons.ts for the reasoning.
    const [threadReactions, replyReactions] = await Promise.all([
      fetchReactionSummaries("thread", [t.id], effectiveUid),
      fetchReactionSummaries("reply", r.map((rep) => rep.id), effectiveUid),
    ]);
    setReactions({ ...threadReactions, ...replyReactions });

    // Which of these this person has already flagged (see lib/commons.ts's
    // hasFlagged) -- same merged-by-id shape as reactions above, thread
    // and reply ids never colliding.
    const [threadFlags, replyFlags] = await Promise.all([
      hasFlagged("thread", [t.id], effectiveUid),
      hasFlagged("reply", r.map((rep) => rep.id), effectiveUid),
    ]);
    setFlaggedMap({ ...threadFlags, ...replyFlags });
  }

  // Stewardship Tier 1 -- the first real trust step (see
  // lib/practices.ts). Nothing reviews or acts on a flag yet; this just
  // starts the record and greys out the button so it reads as "done,"
  // not as a vanishing click.
  async function handleFlag(targetType: ReactionTargetType, targetId: string) {
    if (!userId || flaggedMap[targetId]) return;
    setFlaggingId(targetId);
    setFlagError(null);
    const result = await flagContent(targetType, targetId, userId);
    if (result.ok) {
      setFlaggedMap((prev) => ({ ...prev, [targetId]: true }));
    } else {
      setFlagError(result.error ?? "Couldn't flag that right now.");
    }
    setFlaggingId(null);
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !replyBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createReply({ threadId: params.id, profileId: userId, body: replyBody });
      setReplyBody("");
      await load();
    } catch {
      setError("Couldn't post that reply -- try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  // Optimistic toggle -- updates the on-screen count immediately rather
  // than waiting on a round trip, then fires the real write. Mirrors the
  // exact same-kind-clears / different-kind-switches logic that lives in
  // lib/commons.ts's setReaction, so the local math and the server write
  // never disagree.
  async function handleReact(targetType: ReactionTargetType, targetId: string, kind: ReactionKind) {
    if (!userId) return;
    const current = reactions[targetId]?.mine ?? null;
    setReactions((prev) => {
      const base = prev[targetId] ?? EMPTY_SUMMARY;
      const next: ReactionSummary = { ...base };
      if (current === "heartfelt") next.heartfelt = Math.max(0, next.heartfelt - 1);
      if (current === "heartache") next.heartache = Math.max(0, next.heartache - 1);
      if (current === kind) {
        next.mine = null;
      } else {
        next.mine = kind;
        if (kind === "heartfelt") next.heartfelt += 1;
        else next.heartache += 1;
      }
      return { ...prev, [targetId]: next };
    });
    await setReaction(targetType, targetId, userId, kind, current);
  }

  function reactionRow(targetType: ReactionTargetType, targetId: string) {
    const summary = reactions[targetId] ?? EMPTY_SUMMARY;
    return (
      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <button
          type="button"
          onClick={() => handleReact(targetType, targetId, "heartfelt")}
          style={reactionButtonStyle(summary.mine === "heartfelt", "#c9576a")}
        >
          &#10084;&nbsp;Heartfelt{summary.heartfelt > 0 ? ` ${summary.heartfelt}` : ""}
        </button>
        <button
          type="button"
          onClick={() => handleReact(targetType, targetId, "heartache")}
          style={reactionButtonStyle(summary.mine === "heartache", "#5b5fc7")}
        >
          &#128148;&nbsp;Heartache{summary.heartache > 0 ? ` ${summary.heartache}` : ""}
        </button>
        {stewardshipTier >= 1 && (
          <button
            type="button"
            onClick={() => handleFlag(targetType, targetId)}
            disabled={flaggedMap[targetId] || flaggingId === targetId}
            style={reactionButtonStyle(false, "var(--ink-faint, #5c6684)")}
          >
            {flaggedMap[targetId] ? "Flagged" : flaggingId === targetId ? "..." : "Flag"}
          </button>
        )}
      </div>
    );
  }

  if (checking) return <PageLoading />;

  if (notFound || !thread) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--void)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", marginBottom: "16px" }}>
            That conversation doesn't exist anymore.
          </p>
          <Link href="/commons" style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.85rem" }}>
            &larr; Back to the Commons
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: mySkin.image
          ? `linear-gradient(rgba(5,7,13,0.82), rgba(5,7,13,0.82)), url(${mySkin.image}) center / cover fixed no-repeat`
          : "var(--void)",
        color: "var(--ink)",
        padding: "40px 20px 90px",
        ...(mySkin.vars as React.CSSProperties),
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <Link href="/commons" style={{ display: "inline-block", marginBottom: "22px", color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.82rem", textDecoration: "none" }}>
          &larr; Back to the Commons
        </Link>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ACCENT, margin: "0 0 8px" }}>
          {thread.kind === "question" ? "Question" : "Discussion"} &middot; <span style={{ color: authors[thread.profile_id]?.commons_accent || undefined }}>{authorName(authors[thread.profile_id])}</span>
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", margin: "0 0 16px", lineHeight: 1.3 }}>
          {thread.title}
        </h1>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--ink)", fontSize: "0.98rem", lineHeight: 1.7, marginBottom: "10px", whiteSpace: "pre-wrap" }}>
          {thread.body}
        </p>
        {thread.image_url && (
          <img
            src={thread.image_url}
            alt=""
            style={{ maxWidth: "100%", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "10px", display: "block" }}
          />
        )}
        {thread.resource_url && (
          <a
            href={thread.resource_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block", marginBottom: "10px", padding: "6px 12px", borderRadius: "999px", border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", textDecoration: "none" }}
          >
            Resource &rarr;
          </a>
        )}
        {reactionRow("thread", thread.id)}
        {flagError && <p style={{ color: "#e0703a", fontSize: "0.78rem", margin: "8px 0 0" }}>{flagError}</p>}

        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem", margin: "36px 0 14px" }}>
          {replies.length === 0 ? "No replies yet" : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
        </h2>

        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 26px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {replies.map((r) => (
            <li key={r.id} style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--panel)", border: "1px solid var(--border)" }}>
              <p style={{ margin: "0 0 6px", fontFamily: "var(--font-mono)", fontSize: "9px", color: authors[r.profile_id]?.commons_accent || ACCENT }}>
                {authorName(authors[r.profile_id])}
              </p>
              <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "0.92rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {r.body}
              </p>
              {reactionRow("reply", r.id)}
            </li>
          ))}
        </ul>

        <form onSubmit={handleReply}>
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Add to the conversation..."
            rows={3}
            required
            style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: "0.9rem", marginBottom: "10px", resize: "vertical" }}
          />
          {error && <p style={{ color: "#e0703a", fontSize: "0.8rem", margin: "0 0 8px" }}>{error}</p>}
          <button
            type="submit"
            disabled={busy}
            style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: ACCENT, color: "#1a0d10", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
          >
            {busy ? "Posting..." : "Reply"}
          </button>
        </form>
      </div>
    </main>
  );
}

function reactionButtonStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: "5px 11px",
    borderRadius: "999px",
    border: `1px solid ${active ? color : "var(--border)"}`,
    background: active ? `${color}22` : "transparent",
    color: active ? color : "var(--ink-dim)",
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    letterSpacing: "0.02em",
    cursor: "pointer",
  };
}
