"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import {
  authorName,
  createThread,
  fetchProfilesByIds,
  getCommunityBySlug,
  isCommunityMember,
  joinCommunity,
  listThreads,
  touchPresence,
  type Community,
  type CommonsThread,
  type PublicProfile,
} from "@/lib/commons";

export default function CommunityPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [threads, setThreads] = useState<CommonsThread[]>([]);
  const [authors, setAuthors] = useState<Record<string, PublicProfile>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<"discussion" | "question">("discussion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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

      const c = await getCommunityBySlug(params.slug);
      if (!c) {
        setNotFound(true);
        setChecking(false);
        return;
      }
      setCommunity(c);
      setIsMember(await isCommunityMember(c.id, data.user.id));

      const t = await listThreads({ communityId: c.id });
      setThreads(t);
      setAuthors(await fetchProfilesByIds([c.created_by, ...t.map((th) => th.profile_id)]));

      setChecking(false);
    })();
  }, [router, params.slug]);

  async function handleJoin() {
    if (!userId || !community) return;
    setJoining(true);
    await joinCommunity(community.id, userId);
    setIsMember(true);
    setJoining(false);
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !community || !title.trim() || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const thread = await createThread({ communityId: community.id, profileId: userId, kind, title, body });
      router.push(`/commons/t/${thread.id}`);
    } catch {
      setError("Couldn't post that -- try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <PageLoading />;

  if (notFound || !community) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--void)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", marginBottom: "16px" }}>
            That community doesn't exist (or was renamed).
          </p>
          <Link href="/commons" style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.85rem" }}>
            &larr; Back to the Commons
          </Link>
        </div>
      </main>
    );
  }

  const accent = community.accent || "#c9576a";

  return (
    <main style={{ minHeight: "100vh", background: "var(--void)", color: "var(--ink)", padding: "40px 20px 90px" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <Link href="/commons" style={{ display: "inline-block", marginBottom: "22px", color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.82rem", textDecoration: "none" }}>
          &larr; Back to the Commons
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "10px" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: accent, margin: "0 0 6px" }}>
              Community &middot; started by {authorName(authors[community.created_by])}
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.6rem", margin: "0 0 8px" }}>
              {community.name}
            </h1>
          </div>
          {!isMember ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: accent, color: "#1a0d10", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
            >
              {joining ? "Joining..." : "Join"}
            </button>
          ) : (
            <span style={{ padding: "10px 18px", borderRadius: "10px", border: `1px solid ${accent}`, color: accent, fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase" }}>
              Member
            </span>
          )}
        </div>

        <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "10px" }}>
          {community.description || "No description yet."}
        </p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)", marginBottom: "30px" }}>
          {community.member_count} {community.member_count === 1 ? "member" : "members"}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", margin: 0 }}>Discussions</h2>
          <button
            onClick={() => setFormOpen((v) => !v)}
            style={{ padding: "6px 12px", borderRadius: "999px", border: "1px solid var(--border)", background: "none", color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase", cursor: "pointer" }}
          >
            {formOpen ? "Cancel" : "+ New"}
          </button>
        </div>

        {formOpen && (
          <form onSubmit={handleCreateThread} style={{ marginBottom: "20px", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              {(["discussion", "question"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "999px",
                    border: `1px solid ${kind === k ? accent : "var(--border)"}`,
                    background: kind === k ? `${accent}22` : "transparent",
                    color: kind === k ? accent : "var(--ink-dim)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  {k === "discussion" ? "Discussion" : "Question"}
                </button>
              ))}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--void)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: "0.88rem", marginBottom: "8px" }}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Say more..."
              rows={3}
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--void)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: "0.88rem", marginBottom: "8px", resize: "vertical" }}
            />
            {error && <p style={{ color: "#e0703a", fontSize: "0.8rem", margin: "0 0 8px" }}>{error}</p>}
            <button type="submit" disabled={busy} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: accent, color: "#1a0d10", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
              {busy ? "Posting..." : "Post"}
            </button>
          </form>
        )}

        {threads.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", fontSize: "0.9rem" }}>
            No discussions yet -- start the first one.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/commons/t/${t.id}`}
                  style={{ display: "block", padding: "14px 16px", borderRadius: "12px", background: "var(--panel)", border: "1px solid var(--border)", textDecoration: "none", color: "var(--ink)" }}
                >
                  <p style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.9rem" }}>
                    {t.kind === "question" ? "? " : ""}
                    {t.title}
                  </p>
                  <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--ink-faint, #5c6684)" }}>
                    {authorName(authors[t.profile_id])} &middot; {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
