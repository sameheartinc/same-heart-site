"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSkin } from "@/lib/skins";
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
import { EMPTY_PRACTICE_POINTS, normalizePracticePoints, practiceTier, type PracticePoints } from "@/lib/practices";

export default function CommunityPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [mySkin, setMySkin] = useState(getSkin(null));
  const [community, setCommunity] = useState<Community | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [threads, setThreads] = useState<CommonsThread[]>([]);
  const [authors, setAuthors] = useState<Record<string, PublicProfile>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<"discussion" | "question">("discussion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  // Voice Tier 1 (image attachment) / Guidance Tier 1 (resource link) --
  // see lib/practices.ts. Gated on the poster's own invested Practice
  // points, fetched alongside ship_skin below.
  const [myPracticePoints, setMyPracticePoints] = useState<PracticePoints>(EMPTY_PRACTICE_POINTS);
  const voiceTier = practiceTier(myPracticePoints, "voice");
  const guidanceTier = practiceTier(myPracticePoints, "guidance");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [resourceUrl, setResourceUrl] = useState("");

  // Joining used to be a dead end -- Rob's own report was that after
  // clicking Join, there was nothing left to click to actually say
  // anything ("you should be able to engage immediately after and pump
  // in a response"). Now joining opens the composer immediately and
  // moves focus straight into the title field, so the very next thing
  // you can do is start typing, not hunt for a button.
  useEffect(() => {
    if (formOpen) titleInputRef.current?.focus();
  }, [formOpen]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      touchPresence(data.user.id); // fire-and-forget -- don't block the first paint on this
      // Same Skin as the Hub and the rest of the Commons -- see
      // app/commons/page.tsx. Also pulls practice_points here, so the
      // composer below can show the Voice/Guidance fields only to
      // someone who's actually unlocked them (see lib/practices.ts).
      supabase
        .from("profiles")
        .select("ship_skin, practice_points")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profileRow }) => {
          if (profileRow?.ship_skin) setMySkin(getSkin(profileRow.ship_skin));
          setMyPracticePoints(normalizePracticePoints(profileRow?.practice_points));
        });

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
    setJoinError(null);
    try {
      await joinCommunity(community.id, userId);
      setIsMember(true);
      // Joining should feel like being handed the mic, not just a badge
      // change -- open the composer right away so there's something to
      // click the instant you're in.
      setFormOpen(true);
    } catch {
      setJoinError("Couldn't join that one -- try again in a moment.");
    } finally {
      setJoining(false);
    }
  }

  // Voice Tier 1 -- uploads straight into the commons-images bucket
  // (see supabase/schema.sql's Option A migration), into a folder
  // prefixed with this person's own uid, which is what the bucket's
  // insert policy actually checks. Uploads immediately on file choice
  // so the composer can show a real preview before Post is even
  // clicked, rather than holding the raw file in memory until submit.
  // Voice Tier 2 -- wraps the current textarea selection in ** (bold) or
  // * (italic), same convention every markdown editor uses. Actual
  // rendering happens in lib/richText.tsx; this just makes the syntax
  // easy to reach without typing it by hand. Uses the DOM ref directly
  // (not just React state) so the cursor can be restored after the
  // re-render, via requestAnimationFrame -- setSelectionRange has to run
  // after React has actually painted the new value.
  function wrapSelection(marker: string) {
    const el = bodyInputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const selected = body.slice(start, end);
    const next = body.slice(0, start) + marker + selected + marker + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = selected ? end + marker.length * 2 : start + marker.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setImageUploading(true);
    setImageError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("commons-images").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from("commons-images").getPublicUrl(path);
      setImageUrl(publicUrlData.publicUrl);
    } catch {
      setImageError("Couldn't upload that image -- try again in a moment.");
    } finally {
      setImageUploading(false);
    }
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !community || !title.trim() || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const thread = await createThread({
        communityId: community.id,
        profileId: userId,
        kind,
        title,
        body,
        imageUrl: voiceTier >= 1 ? imageUrl : null,
        resourceUrl: guidanceTier >= 1 ? resourceUrl.trim() || null : null,
      });
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
            <div style={{ textAlign: "right" }}>
              <button
                onClick={handleJoin}
                disabled={joining}
                style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: accent, color: "#1a0d10", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
              >
                {joining ? "Joining..." : "Join"}
              </button>
              {joinError && (
                <p style={{ margin: "6px 0 0", color: "#e0703a", fontSize: "0.75rem", fontFamily: "var(--font-body)" }}>{joinError}</p>
              )}
            </div>
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
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--void)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: "0.88rem", marginBottom: "8px" }}
            />
            {voiceTier >= 2 && (
              <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <button
                  type="button"
                  onClick={() => wrapSelection("**")}
                  title="Bold"
                  style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid var(--border)", background: "none", color: "var(--ink-dim)", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => wrapSelection("*")}
                  title="Italic"
                  style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid var(--border)", background: "none", color: "var(--ink-dim)", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.85rem", cursor: "pointer" }}
                >
                  I
                </button>
              </div>
            )}
            <textarea
              ref={bodyInputRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Say more..."
              rows={3}
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--void)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: "0.88rem", marginBottom: "8px", resize: "vertical" }}
            />
            {voiceTier >= 1 && (
              <div style={{ marginBottom: "8px" }}>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)", marginBottom: "6px" }}>
                  Attach an image (Voice)
                </label>
                {imageUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src={imageUrl} alt="" style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--border)" }} />
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      style={{ padding: "4px 10px", borderRadius: "999px", border: "1px solid var(--border)", background: "none", color: "var(--ink-dim)", fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase", cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <input type="file" accept="image/*" onChange={handleImageChange} disabled={imageUploading} style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--ink-dim)" }} />
                )}
                {imageUploading && <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--ink-dim)" }}>Uploading...</p>}
                {imageError && <p style={{ margin: "6px 0 0", color: "#e0703a", fontSize: "0.78rem" }}>{imageError}</p>}
              </div>
            )}
            {guidanceTier >= 1 && (
              <input
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                placeholder="Resource link (Guidance) -- optional"
                type="url"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--void)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: "0.88rem", marginBottom: "8px" }}
              />
            )}
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
                    <span style={{ color: authors[t.profile_id]?.commons_accent || undefined }}>{authorName(authors[t.profile_id])}</span> &middot; {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
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
