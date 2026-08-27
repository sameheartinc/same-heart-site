"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import {
  authorName,
  createReply,
  fetchProfilesByIds,
  getThread,
  listReplies,
  touchPresence,
  type CommonsReply,
  type CommonsThread,
  type PublicProfile,
} from "@/lib/commons";

const ACCENT = "#c9576a";

export default function ThreadPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [thread, setThread] = useState<CommonsThread | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [replies, setReplies] = useState<CommonsReply[]>([]);
  const [authors, setAuthors] = useState<Record<string, PublicProfile>>({});
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      touchPresence(data.user.id); // fire-and-forget -- don't block the first paint on this
      await load();
      setChecking(false);
    })();
  }, [router, params.id]);

  async function load() {
    const t = await getThread(params.id);
    if (!t) {
      setNotFound(true);
      return;
    }
    setThread(t);
    const r = await listReplies(params.id);
    setReplies(r);
    setAuthors(await fetchProfilesByIds([t.profile_id, ...r.map((rep) => rep.profile_id)]));
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
    <main style={{ minHeight: "100vh", background: "var(--void)", color: "var(--ink)", padding: "40px 20px 90px" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <Link href="/commons" style={{ display: "inline-block", marginBottom: "22px", color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.82rem", textDecoration: "none" }}>
          &larr; Back to the Commons
        </Link>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: ACCENT, margin: "0 0 8px" }}>
          {thread.kind === "question" ? "Question" : "Discussion"} &middot; {authorName(authors[thread.profile_id])}
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", margin: "0 0 16px", lineHeight: 1.3 }}>
          {thread.title}
        </h1>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--ink)", fontSize: "0.98rem", lineHeight: 1.7, marginBottom: "36px", whiteSpace: "pre-wrap" }}>
          {thread.body}
        </p>

        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem", marginBottom: "14px" }}>
          {replies.length === 0 ? "No replies yet" : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
        </h2>

        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 26px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {replies.map((r) => (
            <li key={r.id} style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--panel)", border: "1px solid var(--border)" }}>
              <p style={{ margin: "0 0 6px", fontFamily: "var(--font-mono)", fontSize: "9px", color: ACCENT }}>
                {authorName(authors[r.profile_id])}
              </p>
              <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "0.92rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {r.body}
              </p>
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
