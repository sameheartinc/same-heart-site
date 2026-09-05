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
  fetchMyFlagStatuses,
  fetchProfilesByIds,
  fetchReactionSummaries,
  flagContent,
  getThread,
  hasFlagged,
  listReplies,
  sendEncouragementNote,
  setReaction,
  touchPresence,
  type CommonsReply,
  type CommonsThread,
  type FlagStatus,
  type PublicProfile,
  type ReactionKind,
  type ReactionSummary,
  type ReactionTargetType,
} from "@/lib/commons";
import { EMPTY_PRACTICE_POINTS, normalizePracticePoints, practiceTier, type PracticePoints } from "@/lib/practices";
import { addToShelf, listMyShelf } from "@/lib/resourceShelf";
import { renderRichText } from "@/lib/richText";
import { listMyUnlocks } from "@/lib/evolution";
import { activateBoost } from "@/lib/abilities";

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
  // Stewardship Tier 3 -- "you can see whether a flag you raised was
  // acted on" (see lib/commons.ts's fetchMyFlagStatuses). Fetched
  // unconditionally, same as flaggedMap itself -- the Tier gate below
  // only controls whether the result is actually shown.
  const [flagStatusMap, setFlagStatusMap] = useState<Record<string, FlagStatus>>({});
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);
  // Guidance Tier 2 -- "Save to my Resource Shelf" on a thread's own
  // resource link (see lib/resourceShelf.ts). shelfUrls is just the set
  // of URLs already on this viewer's shelf, so the button can read
  // "Saved" instead of letting them save the same link twice.
  const guidanceTier = practiceTier(myPracticePoints, "guidance");
  const [shelfUrls, setShelfUrls] = useState<Set<string>>(new Set());
  const [savingShelf, setSavingShelf] = useState(false);
  const [shelfError, setShelfError] = useState<string | null>(null);
  // Kinship Tier 2 -- a private encouragement note on someone else's
  // reply (see lib/commons.ts's sendEncouragementNote). encouragedIds is
  // just this session's own "already sent" memory -- RLS only lets a
  // reader see notifications addressed TO them, not ones they sent, so
  // there's no query that could ask "did I already note this reply"
  // across visits. Harmless: the DB function itself still blocks a
  // second note on the same reply either way, this just keeps the
  // button from re-opening once it already worked.
  const kinshipTier = practiceTier(myPracticePoints, "kinship");
  const [encouragingReplyId, setEncouragingReplyId] = useState<string | null>(null);
  const [encourageText, setEncourageText] = useState("");
  const [sendingEncourage, setSendingEncourage] = useState(false);
  const [encourageError, setEncourageError] = useState<string | null>(null);
  const [encouragedIds, setEncouragedIds] = useState<Set<string>>(new Set());
  // Post Boost -- see lib/evolution.ts's "ability-post-boost" and
  // app/api/abilities/boost/route.ts (the only writer of
  // boosted_until). unlockedIds is the same "which Evolution rewards do
  // I hold" set the Hub already tracks -- just fetched here too, since
  // this page needs to know about this one specifically.
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [boosting, setBoosting] = useState(false);
  const [boostError, setBoostError] = useState<string | null>(null);

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
      listMyUnlocks().then((ids) => setUnlockedIds(new Set(ids)));
      await load(data.user.id);
      setChecking(false);
    })();
  }, [router, params.id]);

  // Only fetch the shelf once Guidance Tier 2 is actually confirmed --
  // myPracticePoints starts empty and fills in from the profile fetch
  // above, so this naturally re-runs the moment that lands.
  useEffect(() => {
    if (!userId || guidanceTier < 2) return;
    listMyShelf(userId).then((items) => setShelfUrls(new Set(items.map((item) => item.url))));
  }, [userId, guidanceTier]);

  async function handleSaveToShelf() {
    if (!userId || !thread?.resource_url) return;
    setSavingShelf(true);
    setShelfError(null);
    const result = await addToShelf(userId, thread.resource_url, thread.title, thread.id);
    setSavingShelf(false);
    if (!result.ok) {
      setShelfError(result.error ?? "Couldn't save that right now.");
      return;
    }
    setShelfUrls((prev) => new Set(prev).add(thread.resource_url as string));
  }

  async function handleBoost() {
    if (!thread) return;
    setBoosting(true);
    setBoostError(null);
    const result = await activateBoost(thread.id);
    setBoosting(false);
    if (!result.ok) {
      setBoostError(result.error ?? "Couldn't boost that right now.");
      return;
    }
    setThread({ ...thread, boosted_until: result.boostedUntil ?? thread.boosted_until });
  }

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

    // Stewardship Tier 3 -- see lib/commons.ts's fetchMyFlagStatuses.
    const [threadFlagStatuses, replyFlagStatuses] = await Promise.all([
      fetchMyFlagStatuses("thread", [t.id], effectiveUid),
      fetchMyFlagStatuses("reply", r.map((rep) => rep.id), effectiveUid),
    ]);
    setFlagStatusMap({ ...threadFlagStatuses, ...replyFlagStatuses });
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

  function openEncourage(replyId: string) {
    setEncouragingReplyId(replyId);
    setEncourageText("");
    setEncourageError(null);
  }

  function cancelEncourage() {
    setEncouragingReplyId(null);
    setEncourageText("");
    setEncourageError(null);
  }

  async function submitEncourage(replyId: string) {
    if (!encourageText.trim()) return;
    setSendingEncourage(true);
    setEncourageError(null);
    const result = await sendEncouragementNote(replyId, encourageText);
    setSendingEncourage(false);
    if (!result.ok) {
      setEncourageError(result.error ?? "Couldn't send that right now.");
      return;
    }
    setEncouragedIds((prev) => new Set(prev).add(replyId));
    setEncouragingReplyId(null);
    setEncourageText("");
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

  // Stewardship Tier 3 -- "you can see whether a flag you raised was
  // acted on" (see lib/practices.ts). Below Tier 3, or while it's still
  // pending, the button just reads "Flagged" -- same as it always has.
  function flagLabel(targetId: string): string {
    if (stewardshipTier >= 3) {
      const status = flagStatusMap[targetId];
      if (status === "resolved") return "Flag resolved";
      if (status === "dismissed") return "Flag dismissed";
    }
    return "Flagged";
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
            {flaggedMap[targetId] ? flagLabel(targetId) : flaggingId === targetId ? "..." : "Flag"}
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

        {/* Post Boost -- see lib/evolution.ts's "ability-post-boost" and
            app/api/abilities/boost/route.ts. Only ever shown to the
            thread's own author, and only once they've actually earned
            the ability -- same "stay silent until it's real" posture
            every other gated control on this page follows. */}
        {userId === thread.profile_id && unlockedIds.has("ability-post-boost") && (
          <div style={{ marginBottom: "14px" }}>
            {thread.boosted_until && new Date(thread.boosted_until).getTime() > Date.now() ? (
              <span
                style={{
                  padding: "5px 11px",
                  borderRadius: "999px",
                  border: "1px solid #c9a15a",
                  color: "#c9a15a",
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Boosted until {new Date(thread.boosted_until).toLocaleString()}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleBoost}
                disabled={boosting}
                style={{ padding: "6px 13px", borderRadius: "999px", border: "1px solid #c9a15a", background: "none", color: "#c9a15a", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", cursor: boosting ? "default" : "pointer" }}
              >
                {boosting ? "Boosting..." : "Boost this thread"}
              </button>
            )}
            {boostError && <p style={{ color: "#e0703a", fontSize: "0.78rem", margin: "6px 0 0" }}>{boostError}</p>}
          </div>
        )}

        <p style={{ fontFamily: "var(--font-body)", color: "var(--ink)", fontSize: "0.98rem", lineHeight: 1.7, marginBottom: "10px", whiteSpace: "pre-wrap" }}>
          {renderRichText(thread.body)}
        </p>
        {thread.image_url && (
          <img
            src={thread.image_url}
            alt=""
            style={{ maxWidth: "100%", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "10px", display: "block" }}
          />
        )}
        {thread.resource_url && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
            <a
              href={thread.resource_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", padding: "6px 12px", borderRadius: "999px", border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", textDecoration: "none" }}
            >
              Resource &rarr;
            </a>
            {/* Guidance Tier 2 -- see lib/resourceShelf.ts. Hidden below
                Tier 2 the same way Voice/Guidance Tier 1's own fields are
                gated in the composer -- cosmetic, not a security gate. */}
            {guidanceTier >= 2 &&
              (shelfUrls.has(thread.resource_url) ? (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-faint, #a29cb0)" }}>
                  Saved to your Shelf
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveToShelf}
                  disabled={savingShelf}
                  style={{ padding: "5px 10px", borderRadius: "999px", border: "1px solid var(--border)", background: "none", color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", cursor: savingShelf ? "default" : "pointer" }}
                >
                  {savingShelf ? "Saving..." : "Save to Shelf"}
                </button>
              ))}
          </div>
        )}
        {shelfError && <p style={{ color: "#e0703a", fontSize: "0.78rem", margin: "0 0 10px" }}>{shelfError}</p>}
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
              {/* Kinship Tier 2 -- see lib/commons.ts's
                  sendEncouragementNote. Never shown on your own reply --
                  the note is for showing up for someone else. */}
              {kinshipTier >= 2 && r.profile_id !== userId && (
                <div style={{ marginTop: "8px" }}>
                  {encouragedIds.has(r.id) ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-faint, #a29cb0)" }}>
                      Note sent
                    </span>
                  ) : encouragingReplyId === r.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <textarea
                        value={encourageText}
                        onChange={(e) => setEncourageText(e.target.value)}
                        placeholder="A private word of encouragement, just for them..."
                        rows={2}
                        maxLength={280}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: "0.85rem", resize: "vertical" }}
                      />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => submitEncourage(r.id)}
                          disabled={sendingEncourage || !encourageText.trim()}
                          style={{ padding: "5px 12px", borderRadius: "999px", border: "none", background: "#5b5fc7", color: "#fff", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", cursor: sendingEncourage ? "default" : "pointer" }}
                        >
                          {sendingEncourage ? "Sending..." : "Send privately"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEncourage}
                          disabled={sendingEncourage}
                          style={{ padding: "5px 12px", borderRadius: "999px", border: "1px solid var(--border)", background: "none", color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                      </div>
                      {encourageError && <p style={{ color: "#e0703a", fontSize: "0.76rem", margin: 0 }}>{encourageError}</p>}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEncourage(r.id)}
                      style={{ padding: "5px 11px", borderRadius: "999px", border: "1px solid var(--border)", background: "transparent", color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.02em", cursor: "pointer" }}
                    >
                      &#128172;&nbsp;Encourage
                    </button>
                  )}
                </div>
              )}
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
