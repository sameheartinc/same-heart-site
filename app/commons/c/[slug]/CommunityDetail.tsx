"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSkin, SKINS } from "@/lib/skins";
import PageLoading from "@/components/PageLoading";
import VoiceMarker from "@/components/VoiceMarker";
import { ShareButton } from "@/components/ShareButton";
import {
  authorName,
  createThread,
  fetchCommunityActiveCount,
  fetchProfilesByIds,
  getCommunityBySlug,
  inviteToCircle,
  isCommunityMember,
  joinCommunity,
  listThreads,
  touchPresence,
  updateCommunityTheme,
  type Community,
  type CommonsThread,
  type PublicProfile,
} from "@/lib/commons";
import { EMPTY_PRACTICE_POINTS, normalizePracticePoints, practiceTier, type PracticePoints } from "@/lib/practices";

export default function CommunityDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [mySkin, setMySkin] = useState(getSkin(null));
  const [community, setCommunity] = useState<Community | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isMember, setIsMember] = useState(false);

  // Developer API panel (white-label Communities API, Sep 15, 2026) --
  // creator-only, collapsed by default. See app/api/v1/keys and
  // lib/communityApi.ts.
  // "Who's stepping up" (the Ignition memo's "Realizing initiative"
  // section) -- creator-only, collapsed by default, never a public
  // leaderboard. See lib/initiative.ts for what it actually measures.
  const [initiativeOpen, setInitiativeOpen] = useState(false);
  const [initiativeSignals, setInitiativeSignals] = useState<
    { profile_id: string; display_name: string | null; standing: string; reason: string }[]
  >([]);
  const [initiativeLoading, setInitiativeLoading] = useState(false);
  const [initiativeError, setInitiativeError] = useState<string | null>(null);

  const [apiPanelOpen, setApiPanelOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<
    {
      id: string;
      label: string;
      key_prefix: string;
      created_at: string;
      last_used_at: string | null;
      revoked_at: string | null;
      redirect_uris?: string[];
    }[]
  >([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null);
  const [redirectUriDraft, setRedirectUriDraft] = useState("");
  const [savingRedirectUris, setSavingRedirectUris] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [threads, setThreads] = useState<CommonsThread[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [themeSaving, setThemeSaving] = useState(false);
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

  // Pink's door -- inviting someone into a private circle by Spark ID
  // (see lib/commons.ts's inviteToCircle). Only ever rendered for the
  // circle's own creator; the RPC itself re-checks that server-side too.
  const [inviteSparkId, setInviteSparkId] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  // Joining used to be a dead end -- Rob's own report was that after
  // clicking Join, there was nothing left to click to actually say
  // anything ("you should be able to engage immediately after and pump
  // in a response"). Now joining opens the composer immediately and
  // moves focus straight into the title field, so the very next thing
  // you can do is start typing, not hunt for a button.
  useEffect(() => {
    if (formOpen) titleInputRef.current?.focus();
  }, [formOpen]);

  // Public read for the Commons (Sep 15, 2026) -- Rob: "the same shape
  // as Pinterest and Reddit." A signed-out visitor still gets to see a
  // public circle's description and discussions; a PRIVATE circle
  // still comes back as not-found for them -- that's enforced by RLS
  // on getCommunityBySlug's own read (see supabase/schema.sql), not by
  // anything client-side here. Only the signed-in-only extras
  // (presence, Skin, Practice tiers, membership) are skipped when
  // there's no user.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        touchPresence(uid); // fire-and-forget -- don't block the first paint on this
        // Same Skin as the Hub and the rest of the Commons -- see
        // app/commons/page.tsx. Also pulls practice_points here, so the
        // composer below can show the Voice/Guidance fields only to
        // someone who's actually unlocked them (see lib/practices.ts).
        supabase
          .from("profiles")
          .select("ship_skin, practice_points")
          .eq("id", uid)
          .single()
          .then(({ data: profileRow }) => {
            if (profileRow?.ship_skin) setMySkin(getSkin(profileRow.ship_skin));
            setMyPracticePoints(normalizePracticePoints(profileRow?.practice_points));
          });
      }

      const c = await getCommunityBySlug(slug);
      if (!c) {
        setNotFound(true);
        setChecking(false);
        return;
      }
      setCommunity(c);
      setIsMember(uid ? await isCommunityMember(c.id, uid) : false);
      fetchCommunityActiveCount(c.id).then(setActiveCount);

      const t = await listThreads({ communityId: c.id });
      setThreads(t);
      setAuthors(await fetchProfilesByIds([c.created_by, ...t.map((th) => th.profile_id)]));

      setChecking(false);
    })();
  }, [slug]);

  async function handleJoin() {
    if (!community) return;
    if (!userId) {
      router.push(`/login?next=${encodeURIComponent(`/commons/c/${community.slug}`)}`);
      return;
    }
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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!community) return;
    const sparkId = parseInt(inviteSparkId.trim(), 10);
    if (!sparkId) {
      setInviteMessage("Enter a real Spark ID -- the number on their Hub.");
      return;
    }
    setInviteBusy(true);
    setInviteMessage(null);
    try {
      const { data: found } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .eq("spark_id", sparkId)
        .maybeSingle();
      if (!found) {
        setInviteMessage("No one with that Spark ID.");
        return;
      }
      const result = await inviteToCircle(community.id, found.id);
      if (result.ok) {
        setInviteMessage(`Invited ${found.display_name || `Spark #${sparkId}`} to the circle.`);
        setInviteSparkId("");
      } else {
        setInviteMessage(result.error || "Couldn't send that invite.");
      }
    } catch {
      setInviteMessage("Couldn't reach the server. Try again in a moment.");
    } finally {
      setInviteBusy(false);
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
  // Per-community theming (see PLAN.md and supabase/schema.sql) -- a
  // community's own chosen theme wins over the visitor's personal Skin
  // while looking at that community's own page, same as walking into a
  // room someone else decorated. No theme set yet just shows the
  // visitor's own Skin unchanged, the same as before this existed.
  const effectiveSkin = community.theme_key ? getSkin(community.theme_key) : mySkin;

  async function loadInitiativeSignals() {
    if (!community) return;
    setInitiativeLoading(true);
    setInitiativeError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setInitiativeLoading(false);
      return;
    }
    const res = await fetch(`/api/commons/initiative?communityId=${community.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setInitiativeLoading(false);
    if (!res.ok) {
      setInitiativeError(json.error ?? "Couldn't load that right now.");
      return;
    }
    setInitiativeSignals(json.signals ?? []);
  }

  // Developer API panel handlers -- session-authenticated calls to
  // app/api/v1/keys (see that route's own header comment for why this
  // is session auth, not the API key itself).
  async function loadApiKeys() {
    if (!community) return;
    setApiKeysLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setApiKeysLoading(false);
      return;
    }
    const res = await fetch(`/api/v1/keys?communityId=${community.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setApiKeys(res.ok ? json.keys ?? [] : []);
    setApiKeysLoading(false);
  }

  async function createApiKey() {
    if (!community || creatingKey) return;
    setCreatingKey(true);
    setApiKeyError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setCreatingKey(false);
      return;
    }
    const res = await fetch("/api/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ communityId: community.id, label: newKeyLabel }),
    });
    const json = await res.json();
    setCreatingKey(false);
    if (!res.ok) {
      setApiKeyError(json.error ?? "Couldn't create that key right now.");
      return;
    }
    setRevealedKey(json.key);
    setNewKeyLabel("");
    loadApiKeys();
  }

  async function revokeApiKey(keyId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    await fetch(`/api/v1/keys/${keyId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    loadApiKeys();
  }

  async function saveRedirectUris(keyId: string, uris: string[]) {
    setSavingRedirectUris(true);
    setApiKeyError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSavingRedirectUris(false);
      return;
    }
    const res = await fetch(`/api/v1/keys/${keyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ redirectUris: uris }),
    });
    const json = await res.json();
    setSavingRedirectUris(false);
    if (!res.ok) {
      setApiKeyError(json.error ?? "Couldn't update that right now.");
      return;
    }
    setApiKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, redirect_uris: json.redirect_uris } : k)));
    setRedirectUriDraft("");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: effectiveSkin.image
          ? `linear-gradient(rgba(5,7,13,0.82), rgba(5,7,13,0.82)), url(${effectiveSkin.image}) center / cover fixed no-repeat`
          : "var(--void)",
        color: "var(--ink)",
        padding: "40px 20px 90px",
        ...(effectiveSkin.vars as React.CSSProperties),
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
              {authors[community.created_by]?.has_magenta_string && (
                <span title="Founded by a Magenta Heart String holder" style={{ marginRight: "8px" }}>
                  ★
                </span>
              )}
              {community.name}
              {community.is_private && (
                <span
                  style={{
                    marginLeft: "8px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-dim)",
                    verticalAlign: "middle",
                  }}
                >
                  circle
                </span>
              )}
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

        {/* Rob, Sep 15 2026: "build the share buttons into the threads
            and links/posts." Same no-login-wall shape as a thread's own
            page (see ThreadDetail.tsx) -- a public circle now renders
            for anyone, gated only at Join/New/reply. Skipped for a
            private circle: the link means nothing to someone who
            hasn't been invited. */}
        {!community.is_private && (
          <div style={{ marginBottom: "12px" }}>
            <ShareButton
              url={`https://sameheart.ca/commons/c/${community.slug}`}
              title={community.name}
              text={community.description || "A community on Same Heart"}
            />
          </div>
        )}
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)", marginBottom: community.is_private && userId === community.created_by ? "10px" : "30px" }}>
          {community.member_count} {community.member_count === 1 ? "member" : "members"}
          {activeCount > 0 && (
            <span style={{ color: accent }}>
              {" "}
              &middot; {activeCount} active now
            </span>
          )}
        </p>

        {community.is_private && userId === community.created_by && (
          <form onSubmit={handleInvite} style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "30px" }}>
            <input
              value={inviteSparkId}
              onChange={(e) => setInviteSparkId(e.target.value)}
              placeholder="Invite by Spark ID"
              inputMode="numeric"
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--void)",
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
                fontSize: "0.82rem",
                width: "160px",
              }}
            />
            <button
              type="submit"
              disabled={inviteBusy}
              style={{ padding: "8px 14px", borderRadius: "8px", border: `1px solid ${accent}`, background: "none", color: accent, fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase", cursor: "pointer" }}
            >
              {inviteBusy ? "Inviting..." : "Invite"}
            </button>
            {inviteMessage && (
              <span style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.78rem", color: "var(--ink-dim)" }}>
                {inviteMessage}
              </span>
            )}
          </form>
        )}

        {userId === community.created_by && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "30px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)" }}>
              Theme
            </span>
            <button
              type="button"
              title="Show your own personal Skin instead of a fixed theme"
              onClick={async () => {
                setThemeSaving(true);
                const ok = await updateCommunityTheme(community.id, null);
                if (ok) setCommunity({ ...community, theme_key: null });
                setThemeSaving(false);
              }}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                cursor: "pointer",
                padding: 0,
                background: "repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 8px 8px",
                border: !community.theme_key ? "2px solid var(--gold)" : "2px solid transparent",
              }}
            />
            {SKINS.map((s) => (
              <button
                key={s.key}
                type="button"
                title={s.name}
                aria-label={s.name}
                disabled={themeSaving}
                onClick={async () => {
                  setThemeSaving(true);
                  const ok = await updateCommunityTheme(community.id, s.key);
                  if (ok) setCommunity({ ...community, theme_key: s.key });
                  setThemeSaving(false);
                }}
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  padding: 0,
                  background: s.vars["--panel"],
                  border: community.theme_key === s.key ? "2px solid var(--gold)" : `2px solid ${s.vars["--border"]}`,
                }}
              />
            ))}
          </div>
        )}

        {userId === community.created_by && (
          <div style={{ marginBottom: "22px" }}>
            <button
              type="button"
              onClick={() => {
                const next = !initiativeOpen;
                setInitiativeOpen(next);
                if (next && initiativeSignals.length === 0) loadInitiativeSignals();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--ink-faint, #5c6684)",
              }}
            >
              {initiativeOpen ? "\u25be" : "\u25b8"} Who's stepping up
            </button>

            {initiativeOpen && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--panel, transparent)",
                }}
              >
                <p style={{ margin: "0 0 12px", fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--ink-dim)" }}>
                  Only you can see this. Real activity from the last two weeks, nothing invented, nothing ranked publicly.
                </p>
                {initiativeError && (
                  <p style={{ color: "var(--rose, #c9576a)", fontSize: "0.8rem", marginBottom: "10px" }}>{initiativeError}</p>
                )}
                {initiativeLoading ? (
                  <p style={{ color: "var(--ink-dim)", fontSize: "0.82rem" }}>Loading&hellip;</p>
                ) : initiativeSignals.length === 0 ? (
                  <p style={{ color: "var(--ink-dim)", fontStyle: "italic", fontSize: "0.82rem" }}>
                    Nobody's shown up with a new thread or reply here in the last two weeks yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {initiativeSignals.map((s) => (
                      <div key={s.profile_id} style={{ padding: "10px 12px", borderRadius: "8px", background: "var(--paper-raised, rgba(0,0,0,0.03))" }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", marginBottom: "2px" }}>
                          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)" }}>
                            {s.display_name || "Someone without a display name yet"}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                            {s.standing}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-dim)" }}>{s.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {userId === community.created_by && (
          <div style={{ marginBottom: "22px" }}>
            <button
              type="button"
              onClick={() => {
                const next = !apiPanelOpen;
                setApiPanelOpen(next);
                if (next && apiKeys.length === 0) loadApiKeys();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--ink-faint, #5c6684)",
              }}
            >
              {apiPanelOpen ? "\u25be" : "\u25b8"} Developer API
            </button>

            {apiPanelOpen && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--panel, transparent)",
                }}
              >
                <p style={{ margin: "0 0 12px", fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--ink-dim)" }}>
                  A private key lets your own site or app read this community's roster and discussions, and post into it, without anyone signing in here.
                </p>

                {revealedKey && (
                  <div
                    style={{
                      marginBottom: "14px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--gold)",
                      background: "rgba(212,175,55,0.08)",
                    }}
                  >
                    <p style={{ margin: "0 0 6px", fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase", color: "var(--gold)" }}>
                      Copy this now -- it won't be shown again
                    </p>
                    <code style={{ display: "block", fontSize: "0.78rem", wordBreak: "break-all", color: "var(--ink)" }}>{revealedKey}</code>
                  </div>
                )}

                {apiKeyError && (
                  <p style={{ color: "var(--rose, #c9576a)", fontSize: "0.8rem", marginBottom: "10px" }}>{apiKeyError}</p>
                )}

                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  <input
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="What's this key for? (optional)"
                    style={{
                      flex: 1,
                      background: "var(--void, transparent)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      color: "var(--ink)",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.85rem",
                    }}
                  />
                  <button
                    type="button"
                    onClick={createApiKey}
                    disabled={creatingKey}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "999px",
                      border: "none",
                      background: "var(--gold)",
                      color: "#1a1410",
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: creatingKey ? "default" : "pointer",
                      opacity: creatingKey ? 0.6 : 1,
                    }}
                  >
                    {creatingKey ? "\u2026" : "+ New key"}
                  </button>
                </div>

                {apiKeysLoading ? (
                  <p style={{ color: "var(--ink-dim)", fontSize: "0.82rem" }}>Loading\u2026</p>
                ) : apiKeys.length === 0 ? (
                  <p style={{ color: "var(--ink-dim)", fontStyle: "italic", fontSize: "0.82rem" }}>No keys yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {apiKeys.map((k) => (
                      <div key={k.id} style={{ opacity: k.revoked_at ? 0.5 : 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                        }}
                      >
                        <div>
                          <code style={{ fontSize: "0.8rem", color: "var(--ink)" }}>{k.key_prefix}\u2026</code>
                          <span style={{ marginLeft: "8px", fontSize: "0.78rem", color: "var(--ink-dim)" }}>
                            {k.label || "Untitled"}
                          </span>
                          {k.revoked_at && (
                            <span
                              style={{
                                marginLeft: "8px",
                                fontFamily: "var(--font-mono)",
                                fontSize: "8px",
                                textTransform: "uppercase",
                                color: "var(--ink-faint)",
                              }}
                            >
                              Revoked
                            </span>
                          )}
                        </div>
                        {!k.revoked_at && (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedKeyId(expandedKeyId === k.id ? null : k.id);
                                setRedirectUriDraft("");
                              }}
                              style={{
                                padding: "3px 9px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: "none",
                                color: "var(--ink-faint)",
                                fontFamily: "var(--font-mono)",
                                fontSize: "8px",
                                textTransform: "uppercase",
                                cursor: "pointer",
                              }}
                            >
                              {expandedKeyId === k.id ? "Close" : "Connect setup"}
                            </button>
                            <button
                              type="button"
                              onClick={() => revokeApiKey(k.id)}
                              style={{
                                padding: "3px 9px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: "none",
                                color: "var(--ink-faint)",
                                fontFamily: "var(--font-mono)",
                                fontSize: "8px",
                                textTransform: "uppercase",
                                cursor: "pointer",
                              }}
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </div>

                      {expandedKeyId === k.id && !k.revoked_at && (
                        <div
                          style={{
                            marginTop: "10px",
                            paddingTop: "10px",
                            borderTop: "1px solid var(--border)",
                          }}
                        >
                          <p style={{ margin: "0 0 8px", fontSize: "0.78rem", color: "var(--ink-dim)" }}>
                            client_id for "Connect with Same Heart" links: <code>{k.id}</code>. Only URLs listed
                            here can receive a code from a connect request for this key.
                          </p>
                          {(k.redirect_uris ?? []).length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
                              {(k.redirect_uris ?? []).map((uri) => (
                                <div key={uri} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                  <code style={{ fontSize: "0.76rem", color: "var(--ink)", wordBreak: "break-all" }}>{uri}</code>
                                  <button
                                    type="button"
                                    onClick={() => saveRedirectUris(k.id, (k.redirect_uris ?? []).filter((u) => u !== uri))}
                                    disabled={savingRedirectUris}
                                    style={{ background: "none", border: "none", color: "var(--ink-faint)", cursor: "pointer", fontSize: "0.8rem" }}
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: "6px" }}>
                            <input
                              value={redirectUriDraft}
                              onChange={(e) => setRedirectUriDraft(e.target.value)}
                              placeholder="https://yourapp.com/connect/callback"
                              style={{
                                flex: 1,
                                background: "var(--void, transparent)",
                                border: "1px solid var(--border)",
                                borderRadius: "8px",
                                padding: "6px 8px",
                                color: "var(--ink)",
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.76rem",
                              }}
                            />
                            <button
                              type="button"
                              disabled={savingRedirectUris || !redirectUriDraft.trim()}
                              onClick={() =>
                                saveRedirectUris(k.id, [...(k.redirect_uris ?? []), redirectUriDraft.trim()])
                              }
                              style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: "none",
                                color: "var(--ink-dim)",
                                fontFamily: "var(--font-mono)",
                                fontSize: "9px",
                                textTransform: "uppercase",
                                cursor: "pointer",
                              }}
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", margin: 0 }}>Discussions</h2>
          <button
            onClick={() => {
              if (!userId) {
                router.push(`/login?next=${encodeURIComponent(`/commons/c/${community.slug}`)}`);
                return;
              }
              setFormOpen((v) => !v);
            }}
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
                    <span style={{ color: authors[t.profile_id]?.commons_accent || undefined }}>{authorName(authors[t.profile_id])}</span>
                    {authors[t.profile_id]?.has_black_string && (
                      <span title="Black Heart String -- the meta-key" style={{ marginLeft: "4px" }}>✦</span>
                    )}
                    <VoiceMarker practicePoints={authors[t.profile_id]?.practice_points} /> &middot; {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
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
