"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSkin } from "@/lib/skins";
import PageLoading from "@/components/PageLoading";
import CommonsSphere from "@/components/CommonsSphere";
import CommonsGuide from "@/components/CommonsGuide";
import {
  authorName,
  createCommunity,
  createThread,
  fetchCommonsStats,
  fetchProfilesByIds,
  fetchSignal,
  listCommunities,
  listThreads,
  recordSignalEngagement,
  touchPresence,
  type Community,
  type CommonsThread,
  type NewsArticle,
  type PublicProfile,
} from "@/lib/commons";
import { listRecentTransmissions, transmitLink, type Transmission } from "@/lib/exchange";
import { getWorldIssue } from "@/lib/worldIssues";

const SEEN_KEY = "commons-entrance-seen";
const ACCENT = "#c9576a";

// Bright colors a submitted tagline can render in -- picked fresh (not
// stored) every time a transmission renders, so the same tagline can show
// up in a different color on a later render/reload. Chosen to read clearly
// against the dark Commons background.
const TAGLINE_COLORS = [
  "#ff5f6d",
  "#ffd166",
  "#06d6a0",
  "#4cc9f0",
  "#c77dff",
  "#ff70a6",
  "#f72585",
  "#7bf1a8",
  "#ff9f1c",
];

function randomTaglineColor(): string {
  return TAGLINE_COLORS[Math.floor(Math.random() * TAGLINE_COLORS.length)];
}

export default function CommonsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [mySkin, setMySkin] = useState(getSkin(null));
  const [stage, setStage] = useState<"entrance" | "home">("entrance");
  const [entranceStep, setEntranceStep] = useState(0);
  const [pendingQuery, setPendingQuery] = useState("");

  const [stats, setStats] = useState({ humansPresent: 0, communitiesActive: 0, activeConversations: 0 });
  const [signal, setSignal] = useState<NewsArticle[]>([]);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());
  const [communities, setCommunities] = useState<Community[]>([]);
  const [liveThreads, setLiveThreads] = useState<CommonsThread[]>([]);
  const [questionThreads, setQuestionThreads] = useState<CommonsThread[]>([]);
  const [searchResults, setSearchResults] = useState<CommonsThread[] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [authors, setAuthors] = useState<Record<string, PublicProfile>>({});

  const [newCommunityOpen, setNewCommunityOpen] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState("");
  const [newCommunityDesc, setNewCommunityDesc] = useState("");
  const [newCommunityBusy, setNewCommunityBusy] = useState(false);
  const [newCommunityError, setNewCommunityError] = useState<string | null>(null);

  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newThreadKind, setNewThreadKind] = useState<"discussion" | "question">("discussion");
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadBody, setNewThreadBody] = useState("");
  const [newThreadBusy, setNewThreadBusy] = useState(false);
  const [newThreadError, setNewThreadError] = useState<string | null>(null);

  // The Exchange -- transmitting links, and the incoming feed of them.
  const [transmissions, setTransmissions] = useState<Transmission[]>([]);
  const [transmitUrl, setTransmitUrl] = useState("");
  const [transmitTagline, setTransmitTagline] = useState("");
  const [transmitImageUrl, setTransmitImageUrl] = useState<string | null>(null);
  const [transmitImageUploading, setTransmitImageUploading] = useState(false);
  const [transmitBusy, setTransmitBusy] = useState(false);
  const [transmitError, setTransmitError] = useState<string | null>(null);
  const [transmitSuccess, setTransmitSuccess] = useState<{
    heartbeats: number;
    dailyCapReached: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      touchPresence(data.user.id); // fire-and-forget -- don't block the first paint on this
      // Same Skin the Hub uses, carried over here -- previously the
      // Commons was always the default palette no matter what someone
      // picked on the Hub, which made the two feel like different
      // products. One extra column read, no new state to manage.
      supabase
        .from("profiles")
        .select("ship_skin")
        .eq("id", data.user.id)
        .single()
        .then(({ data: skinRow }) => {
          if (skinRow?.ship_skin) setMySkin(getSkin(skinRow.ship_skin));
        });
      const seen = typeof window !== "undefined" && window.localStorage.getItem(SEEN_KEY);
      if (seen) setStage("home");
      setChecking(false);
    })();
  }, [router]);

  // The entrance sequence -- dark, then the two lines, then the sphere
  // and the question. Only plays once per browser (see SEEN_KEY); every
  // return visit lands straight in the home view.
  useEffect(() => {
    if (checking || stage !== "entrance") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setEntranceStep(3);
      return;
    }
    const timers = [
      setTimeout(() => setEntranceStep(1), 500),
      setTimeout(() => setEntranceStep(2), 2400),
      setTimeout(() => setEntranceStep(3), 4300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [checking, stage]);

  const loadHome = useCallback(async () => {
    const [statsData, communitiesData, live, questions, signalData, transmissionsData] = await Promise.all([
      fetchCommonsStats(),
      listCommunities(),
      listThreads({ limit: 6 }),
      listThreads({ kind: "question", limit: 6 }),
      fetchSignal(8),
      listRecentTransmissions(12),
    ]);
    setStats(statsData);
    setCommunities(communitiesData);
    setLiveThreads(live);
    setQuestionThreads(questions);
    setSignal(signalData);
    setTransmissions(transmissionsData);

    const ids = [
      ...communitiesData.map((c) => c.created_by),
      ...live.map((t) => t.profile_id),
      ...questions.map((t) => t.profile_id),
      ...transmissionsData.map((t) => t.profile_id),
    ];
    setAuthors(await fetchProfilesByIds(ids));
  }, []);

  useEffect(() => {
    if (stage === "home") loadHome();
  }, [stage, loadHome]);

  // Verify each Signal article's image actually loads before trusting it --
  // a URL can be present but still 404 or get blocked by hotlink
  // protection, and CSS background-image fails silently in that case (no
  // broken-image icon, but no "No image" placeholder either). This
  // preloads each one and falls back to the placeholder gradient for any
  // that fail to load, so a bad image never just leaves a blank panel.
  useEffect(() => {
    let cancelled = false;
    const withImages = signal.filter((a) => a.image_url);
    if (withImages.length === 0) return;
    for (const article of withImages) {
      const img = new Image();
      img.onerror = () => {
        if (cancelled) return;
        setBrokenImageIds((prev) => {
          if (prev.has(article.id)) return prev;
          const next = new Set(prev);
          next.add(article.id);
          return next;
        });
      };
      img.src = article.image_url as string;
    }
    return () => {
      cancelled = true;
    };
  }, [signal]);

  function enterCommons(query?: string) {
    if (typeof window !== "undefined") window.localStorage.setItem(SEEN_KEY, "1");
    setStage("home");
    if (query && query.trim()) {
      setSearchTerm(query.trim());
      runSearch(query.trim());
    }
  }

  async function runSearch(term: string) {
    if (!term.trim()) {
      setSearchResults(null);
      return;
    }
    const results = await listThreads({ search: term, limit: 20 });
    setSearchResults(results);
    setAuthors((prev) => ({ ...prev }));
    const ids = results.map((t) => t.profile_id);
    const more = await fetchProfilesByIds(ids);
    setAuthors((prev) => ({ ...prev, ...more }));
  }

  async function handleCreateCommunity(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !newCommunityName.trim()) return;
    setNewCommunityBusy(true);
    setNewCommunityError(null);
    try {
      const community = await createCommunity({
        name: newCommunityName,
        description: newCommunityDesc,
        accent: ACCENT,
        createdBy: userId,
      });
      setNewCommunityName("");
      setNewCommunityDesc("");
      setNewCommunityOpen(false);
      router.push(`/commons/c/${community.slug}`);
    } catch (err: any) {
      setNewCommunityError(
        err?.code === "23505" ? "A community with that name already exists." : "Couldn't create that -- try again."
      );
    } finally {
      setNewCommunityBusy(false);
    }
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !newThreadTitle.trim() || !newThreadBody.trim()) return;
    setNewThreadBusy(true);
    setNewThreadError(null);
    try {
      const thread = await createThread({
        communityId: null,
        profileId: userId,
        kind: newThreadKind,
        title: newThreadTitle,
        body: newThreadBody,
      });
      router.push(`/commons/t/${thread.id}`);
    } catch {
      setNewThreadError("Couldn't post that -- try again in a moment.");
    } finally {
      setNewThreadBusy(false);
    }
  }

  async function handleTransmit(e: React.FormEvent) {
    e.preventDefault();
    const url = transmitUrl.trim();
    if (!url) return;
    setTransmitBusy(true);
    setTransmitError(null);
    setTransmitSuccess(null);
    try {
      const result = await transmitLink(url, transmitTagline, transmitImageUrl || undefined);
      setTransmissions((prev) => [result.transmission, ...prev].slice(0, 12));
      setTransmitSuccess({ heartbeats: result.heartbeatsAwarded, dailyCapReached: result.dailyCapReached });
      setTransmitUrl("");
      setTransmitTagline("");
      setTransmitImageUrl(null);
    } catch (err) {
      setTransmitError(err instanceof Error ? err.message : "That transmission didn't go through.");
    } finally {
      setTransmitBusy(false);
    }
  }

  // A photo alongside a transmission -- purely decorative, uploaded
  // straight to the exchange-photos bucket the moment it's picked, so
  // it's just a URL by the time handleTransmit actually submits. See
  // supabase/schema.sql's comment on exchange_transmissions.image_url
  // for the real tradeoff this takes on (this one's visible to every
  // Commons member, not just the uploader).
  const MAX_TRANSMIT_IMAGE_BYTES = 8 * 1024 * 1024;

  async function uploadTransmitPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      setTransmitError("That doesn't look like an image.");
      return;
    }
    if (file.size > MAX_TRANSMIT_IMAGE_BYTES) {
      setTransmitError("Keep the photo under 8MB.");
      return;
    }

    setTransmitError(null);
    setTransmitImageUploading(true);

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("exchange-photos").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

    setTransmitImageUploading(false);
    if (uploadError) {
      setTransmitError("Couldn't upload that photo -- try again.");
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("exchange-photos").getPublicUrl(path);
    setTransmitImageUrl(publicUrlData.publicUrl);
  }

  if (checking) return <PageLoading />;

  if (stage === "entrance") {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--void)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <style>{`
          @keyframes commonsLineIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .commons-line { animation: commonsLineIn 1.1s ease both; }
          @media (prefers-reduced-motion: reduce) { .commons-line { animation: none; } }
        `}</style>

        {entranceStep >= 1 && entranceStep < 3 && (
          <button
            onClick={() => enterCommons()}
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              background: "none",
              border: "none",
              color: "var(--ink-faint, #5c6684)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Skip
          </button>
        )}

        {entranceStep === 1 && (
          <p
            key="line1"
            className="commons-line"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
              letterSpacing: "0.04em",
              textAlign: "center",
              color: "var(--ink)",
            }}
          >
            THE WORLD IS TALKING.
          </p>
        )}

        {entranceStep === 2 && (
          <p
            key="line2"
            className="commons-line"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(1.4rem, 4vw, 2.2rem)",
              letterSpacing: "0.04em",
              textAlign: "center",
              color: ACCENT,
            }}
          >
            ARE YOU LISTENING?
          </p>
        )}

        {entranceStep >= 3 && (
          <div key="reveal" className="commons-line" style={{ textAlign: "center", maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
              <CommonsSphere size={220} humansPresent={stats.humansPresent || 12} />
            </div>

            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-dim)",
                marginBottom: "26px",
              }}
            >
              The Commons is alive
            </p>

            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "clamp(1.2rem, 3.4vw, 1.7rem)",
                margin: "0 0 22px",
                color: "var(--ink)",
              }}
            >
              What do you want to understand?
            </h1>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                enterCommons(pendingQuery);
              }}
              style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}
            >
              <input
                autoFocus
                value={pendingQuery}
                onChange={(e) => setPendingQuery(e.target.value)}
                placeholder="Why does nobody agree about this?"
                style={{
                  flex: "1 1 260px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.95rem",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "14px 22px",
                  borderRadius: "12px",
                  border: "none",
                  background: ACCENT,
                  color: "#1a0d10",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Enter The Commons
              </button>
            </form>
          </div>
        )}
      </main>
    );
  }

  const showingSearch = searchResults !== null;

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
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "22px",
          }}
        >
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
          <Link
            href="/commons/conversations"
            style={{
              color: "#c9a15a",
              fontFamily: "var(--font-display)",
              fontSize: "0.82rem",
              textDecoration: "none",
            }}
          >
            My Conversations &rarr;
          </Link>
          <Link
            href="/shop"
            style={{
              color: "#7c9fd9",
              fontFamily: "var(--font-display)",
              fontSize: "0.82rem",
              textDecoration: "none",
            }}
          >
            The Merch Ship &rarr;
          </Link>
        </div>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: ACCENT,
            margin: "0 0 8px",
          }}
        >
          The Commons
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.7rem", margin: "0 0 22px" }}>
          The world is talking.
        </h1>

        {!showingSearch && signal.length > 0 && (
          <SignalBubble articles={signal} userId={userId} brokenImageIds={brokenImageIds} />
        )}

        {/* Live presence bar -- every number here is real, queried fresh
            on load. Nothing simulated. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "12px",
            marginBottom: "30px",
          }}
        >
          <StatCard label="Humans present" value={stats.humansPresent} sub="last 5 min" />
          <StatCard label="Active conversations" value={stats.activeConversations} sub="last 24h" />
          {/* The forums main page (app/commons/communities/page.tsx) --
              every community, plus a way to start one. This card used
              to just be a number; now it's a real front door. */}
          <Link href="/commons/communities" style={{ textDecoration: "none", color: "inherit" }}>
            <StatCard label="Communities" value={stats.communitiesActive} sub="" />
          </Link>
          <StatCard label="Projects" value="Not open yet" sub="" muted />
        </div>

        {/* The Exchange -- transmit a link, get it weighed against real
            global issues, earn Heartbeats for genuine impact. See
            lib/exchange.ts / app/api/exchange/transmit/route.ts. */}
        <div
          style={{
            background: "linear-gradient(180deg, rgba(124,159,217,0.06), transparent)",
            border: "1px solid rgba(124,159,217,0.35)",
            borderRadius: "16px",
            padding: "22px",
            marginBottom: "34px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "14px",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#7c9fd9",
                }}
              >
                Comms Deck &middot; The Exchange
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  color: "var(--ink-dim)",
                  fontSize: "0.85rem",
                }}
              >
                Dial in what actually matters. Transmit a link -- an article, a video, a
                thread -- and it&rsquo;s weighed against the world&rsquo;s real problems.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Link
                href="/commons/roster"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#7c9fd9",
                  textDecoration: "none",
                  border: "1px solid rgba(124,159,217,0.5)",
                  borderRadius: "999px",
                  padding: "8px 14px",
                  whiteSpace: "nowrap",
                }}
              >
                View the Roster &rarr;
              </Link>
              <Link
                href="/commons/here"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#d9503f",
                  textDecoration: "none",
                  border: "1px solid rgba(217,80,63,0.5)",
                  borderRadius: "999px",
                  padding: "8px 14px",
                  whiteSpace: "nowrap",
                }}
              >
                Who&rsquo;s Here &rarr;
              </Link>
            </div>
          </div>

          <form
            onSubmit={handleTransmit}
            style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}
          >
            <input
              value={transmitUrl}
              onChange={(e) => setTransmitUrl(e.target.value)}
              placeholder="Drop an X, YouTube, Facebook, or other link -- https://example.com"
              type="url"
              required
              style={{
                flex: "2 1 320px",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(124,159,217,0.4)",
                background: "var(--panel)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
              }}
            />
            <input
              value={transmitTagline}
              onChange={(e) => setTransmitTagline(e.target.value)}
              placeholder="Bold tagline (optional)"
              type="text"
              maxLength={80}
              style={{
                flex: "1 1 160px",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(124,159,217,0.4)",
                background: "var(--panel)",
                color: "var(--ink)",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 14px",
                borderRadius: "10px",
                border: "1px solid rgba(124,159,217,0.4)",
                background: transmitImageUrl ? "rgba(124,159,217,0.12)" : "var(--panel)",
                color: "#7c9fd9",
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                cursor: transmitImageUploading ? "default" : "pointer",
                opacity: transmitImageUploading ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {transmitImageUploading
                ? "Uploading..."
                : transmitImageUrl
                ? "Photo attached ✓"
                : "+ Photo"}
              <input
                type="file"
                accept="image/*"
                onChange={uploadTransmitPhoto}
                disabled={transmitImageUploading}
                style={{ display: "none" }}
              />
            </label>
            <button
              type="submit"
              disabled={transmitBusy}
              style={{
                padding: "12px 20px",
                borderRadius: "10px",
                border: "1px solid #7c9fd9",
                background: "rgba(124,159,217,0.12)",
                color: "#7c9fd9",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.8rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: transmitBusy ? "default" : "pointer",
                opacity: transmitBusy ? 0.6 : 1,
              }}
            >
              {transmitBusy ? "Scanning..." : "Transmit"}
            </button>
          </form>

          {transmitImageUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <img
                src={transmitImageUrl}
                alt=""
                style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover", border: "1px solid rgba(124,159,217,0.4)" }}
              />
              <button
                type="button"
                onClick={() => setTransmitImageUrl(null)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--ink-faint, #5c6684)",
                  cursor: "pointer",
                }}
              >
                Remove photo
              </button>
            </div>
          )}

          {transmitError && (
            <p
              style={{
                margin: "0 0 14px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--rose)",
              }}
            >
              {transmitError}
            </p>
          )}
          {transmitSuccess && (
            <p
              style={{
                margin: "0 0 14px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "#7c9fd9",
              }}
            >
              +{transmitSuccess.heartbeats} Heartbeats received.
              {transmitSuccess.dailyCapReached && " You've hit today's Exchange ceiling -- more tomorrow."}
            </p>
          )}

          {/* Incoming transmissions -- other ships' signals, most recent
              first. Deliberately styled like a comms log, not a social
              feed. */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {transmissions.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--ink-faint, #5c6684)",
                }}
              >
                No transmissions yet. Be the first ship to send one.
              </p>
            ) : (
              transmissions.slice(0, 6).map((t) => {
                const sender = authors[t.profile_id];
                const shipId = sender?.designation || sender?.display_name || "Unknown ship";
                const issue = getWorldIssue(t.issue_key);
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "rgba(124,159,217,0.05)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                      <span style={{ color: "#7c9fd9", flexShrink: 0 }}>&#9679;</span>
                      <span style={{ color: "var(--ink-faint, #5c6684)", flexShrink: 0 }}>{shipId}</span>
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "var(--ink-dim)",
                          textDecoration: "none",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={t.title ?? t.url}
                      >
                        {t.title ?? t.domain ?? t.url}
                      </a>
                      {issue && (
                        <span style={{ color: "var(--ink-faint, #5c6684)", flexShrink: 0 }}>{issue.label}</span>
                      )}
                      <span style={{ color: "var(--gold)", flexShrink: 0 }}>+{t.heartbeats_awarded}</span>
                    </div>
                    {t.tagline && (
                      <div
                        style={{
                          paddingLeft: "20px",
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: "12px",
                          color: randomTaglineColor(),
                        }}
                      >
                        {t.tagline}
                      </div>
                    )}
                    {t.image_url && (
                      <img
                        src={t.image_url}
                        alt=""
                        style={{
                          marginLeft: "20px",
                          width: "72px",
                          height: "72px",
                          borderRadius: "8px",
                          objectFit: "cover",
                          border: "1px solid rgba(124,159,217,0.3)",
                        }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(searchTerm);
          }}
          style={{ display: "flex", gap: "10px", marginBottom: "34px", flexWrap: "wrap" }}
        >
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search discussions and questions..."
            style={{
              flex: "1 1 240px",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--panel)",
              color: "var(--ink)",
              fontFamily: "var(--font-body)",
              fontSize: "0.9rem",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "12px 18px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--panel)",
              color: "var(--ink)",
              fontFamily: "var(--font-display)",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Search
          </button>
          {showingSearch && (
            <button
              type="button"
              onClick={() => {
                setSearchResults(null);
                setSearchTerm("");
              }}
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                border: "none",
                background: "none",
                color: "var(--ink-faint, #5c6684)",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </form>

        {showingSearch ? (
          <Section title={`Results for "${searchTerm}"`}>
            {searchResults!.length === 0 ? (
              <EmptyState>
                Nobody's asked this yet. Be the first --
                <button
                  onClick={() => {
                    setNewThreadOpen(true);
                    setNewThreadKind("question");
                    setNewThreadTitle(searchTerm);
                  }}
                  style={linkButtonStyle}
                >
                  start the question
                </button>
                .
              </EmptyState>
            ) : (
              <ThreadList threads={searchResults!} authors={authors} />
            )}
          </Section>
        ) : (
          <>
            <Section
              title="Communities"
              action={
                <button onClick={() => setNewCommunityOpen((v) => !v)} style={communityActionStyle}>
                  {newCommunityOpen ? "Cancel" : "+ Start a community"}
                </button>
              }
            >
              <p
                style={{
                  margin: "0 0 16px",
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  color: "var(--ink-dim)",
                  fontSize: "0.85rem",
                  maxWidth: "60ch",
                }}
              >
                A space inside the Commons built around one shared interest -- anyone can start
                one, and you become its first member the moment you do.
              </p>
              {newCommunityOpen && (
                <form onSubmit={handleCreateCommunity} style={{ marginBottom: "18px" }}>
                  <input
                    value={newCommunityName}
                    onChange={(e) => setNewCommunityName(e.target.value)}
                    placeholder="Community name"
                    required
                    style={{ ...inputStyle, marginBottom: "8px" }}
                  />
                  <textarea
                    value={newCommunityDesc}
                    onChange={(e) => setNewCommunityDesc(e.target.value)}
                    placeholder="What's it about?"
                    rows={2}
                    style={{ ...inputStyle, marginBottom: "8px", resize: "vertical" as const }}
                  />
                  {newCommunityError && <p style={errorStyle}>{newCommunityError}</p>}
                  <button type="submit" disabled={newCommunityBusy} style={submitButtonStyle}>
                    {newCommunityBusy ? "Creating..." : "Create community"}
                  </button>
                </form>
              )}
              {communities.length === 0 ? (
                <EmptyState>No communities yet -- start the first one.</EmptyState>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                  {communities.map((c) => (
                    <Link
                      key={c.id}
                      href={`/commons/c/${c.slug}`}
                      style={{
                        display: "block",
                        padding: "16px",
                        borderRadius: "14px",
                        background: "var(--panel)",
                        border: `1px solid ${c.accent}44`,
                        textDecoration: "none",
                        color: "var(--ink)",
                      }}
                    >
                      <p style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem" }}>
                        {c.name}
                      </p>
                      <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.8rem", color: "var(--ink-dim)" }}>
                        {c.description || "No description yet."}
                      </p>
                      <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: c.accent }}>
                        {c.member_count} {c.member_count === 1 ? "member" : "members"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Section>

            {signal.length > 0 && (
              <Section title="The Signal">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {signal.map((article) => {
                    const imageOk = Boolean(article.image_url) && !brokenImageIds.has(article.id);
                    return (
                    <a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => userId && recordSignalEngagement(userId, article.id)}
                      style={{
                        display: "block",
                        borderRadius: "14px",
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                        overflow: "hidden",
                        textDecoration: "none",
                        color: "var(--ink)",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "16 / 9",
                          background: imageOk
                            ? `center/cover no-repeat url(${article.image_url})`
                            : "linear-gradient(135deg, var(--void), var(--panel))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {!imageOk && (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "9px",
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              color: "var(--ink-faint, #5c6684)",
                            }}
                          >
                            No image
                          </span>
                        )}
                      </div>
                      <div style={{ padding: "12px 14px" }}>
                        <p
                          style={{
                            margin: "0 0 6px",
                            fontFamily: "var(--font-display)",
                            fontWeight: 600,
                            fontSize: "0.86rem",
                            lineHeight: 1.35,
                          }}
                        >
                          {article.title}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: "var(--font-mono)",
                            fontSize: "8px",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: ACCENT,
                          }}
                        >
                          {article.source_name ?? "Unknown source"}
                        </p>
                      </div>
                    </a>
                    );
                  })}
                </div>
              </Section>
            )}

            <Section
              title="Live now"
              action={
                <button onClick={() => setNewThreadOpen((v) => !v)} style={smallActionStyle}>
                  {newThreadOpen ? "Cancel" : "+ Start a discussion"}
                </button>
              }
            >
              {newThreadOpen && (
                <NewThreadForm
                  kind={newThreadKind}
                  setKind={setNewThreadKind}
                  title={newThreadTitle}
                  setTitle={setNewThreadTitle}
                  body={newThreadBody}
                  setBody={setNewThreadBody}
                  busy={newThreadBusy}
                  error={newThreadError}
                  onSubmit={handleCreateThread}
                />
              )}
              {liveThreads.length === 0 ? (
                <EmptyState>Nothing yet -- be the first to start a conversation.</EmptyState>
              ) : (
                <ThreadList threads={liveThreads} authors={authors} />
              )}
            </Section>

            <Section title="Unanswered">
              {questionThreads.length === 0 ? (
                <EmptyState>No open questions yet.</EmptyState>
              ) : (
                <ThreadList threads={questionThreads} authors={authors} />
              )}
            </Section>

          </>
        )}

        <p
          style={{
            marginTop: "50px",
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-faint, #5c6684)",
            fontSize: "0.82rem",
            lineHeight: 1.7,
          }}
        >
          What's here now: real communities, real discussions and
          questions, real replies, a live presence count, and The Signal
          -- real headlines, refreshed hourly from real sources -- all
          backed by the database, nothing simulated. The Commons Guide
          (bottom right) is a real, live AI chat too now. What's not
          built yet: live group chat, deeper AI-assisted analysis,
          Projects, Exchange impact-tracking, and the full 3D
          scanned-room experience from the original vision. Those are
          real, tracked next phases -- not forgotten, just not here
          today.
        </p>
      </div>

      <CommonsGuide />
    </main>
  );
}

function SignalBubble({
  articles,
  userId,
  brokenImageIds,
}: {
  articles: NewsArticle[];
  userId: string | null;
  brokenImageIds: Set<string>;
}) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  // Both the auto-advance timer and the manual arrows below share this
  // one transition -- the functional setIndex form means neither one
  // depends on a possibly-stale `index` closure, so clicking an arrow
  // mid-auto-advance (or the reverse) always lands on the right story.
  function goTo(step: 1 | -1) {
    if (articles.length <= 1) return;
    setFading(true);
    setTimeout(() => {
      setIndex((i) => (i + step + articles.length) % articles.length);
      setFading(false);
    }, 380);
  }

  useEffect(() => {
    if (articles.length <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = setInterval(() => goTo(1), 6500);
    return () => clearInterval(id);
  }, [articles.length]);

  if (articles.length === 0) return null;
  const article = articles[Math.min(index, articles.length - 1)];
  const imageOk = Boolean(article.image_url) && !brokenImageIds.has(article.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "38px" }}>
      <style>{`
        @keyframes signalBubbleGlow {
          0%, 100% { box-shadow: 0 0 50px rgba(201,87,106,0.28), inset 0 0 70px rgba(0,0,0,0.4); }
          50%      { box-shadow: 0 0 85px rgba(201,87,106,0.48), inset 0 0 70px rgba(0,0,0,0.4); }
        }
        @keyframes signalDotPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.3); }
        }
        .signal-bubble { animation: signalBubbleGlow 4.5s ease-in-out infinite; }
        .signal-live-dot { animation: signalDotPulse 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .signal-bubble { animation: none; }
          .signal-live-dot { animation: none; opacity: 0.9; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "16px" }}>
        <span
          className="signal-live-dot"
          style={{ width: "9px", height: "9px", borderRadius: "50%", background: ACCENT, display: "inline-block" }}
        />
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          The Signal &middot; Live
        </p>
      </div>

      <div style={{ position: "relative", width: "min(230px, 62vw)" }}>
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => userId && recordSignalEngagement(userId, article.id)}
        className="signal-bubble"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          borderRadius: "20px",
          overflow: "hidden",
          textDecoration: "none",
          display: "block",
          background: imageOk
            ? `center/cover no-repeat url(${article.image_url})`
            : "radial-gradient(circle at 35% 30%, rgba(201,87,106,0.35), var(--void))",
          border: "1px solid rgba(201,87,106,0.55)",
          opacity: fading ? 0 : 1,
          transition: "opacity 0.38s ease",
        }}
      >
        {/* Glass sheen -- a soft highlight arcing across the top-left,
            like light catching the curve of glass. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(155deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0) 55%)",
          }}
        />
        {/* Inner rim shadow so the image reads as curved, not flat */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 26px rgba(0,0,0,0.55)", borderRadius: "20px" }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "14px 14px 12px",
            background: "linear-gradient(to top, rgba(8,10,18,0.96), rgba(8,10,18,0.05) 60%, rgba(8,10,18,0) 100%)",
          }}
        >
          <p
            style={{
              margin: "0 0 4px",
              fontFamily: "var(--font-body)",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#fff",
              lineHeight: 1.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }}
          >
            {article.title}
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: "8px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            {article.source_name ?? "Unknown source"}
          </p>
        </div>
      </a>

      {articles.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(-1)}
            aria-label="Previous story"
            style={{
              position: "absolute",
              left: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              border: "1px solid rgba(201,87,106,0.6)",
              background: "rgba(8,10,18,0.55)",
              color: ACCENT,
              fontSize: "16px",
              lineHeight: 1,
              cursor: "pointer",
              boxShadow: "0 0 14px rgba(201,87,106,0.55)",
            }}
          >
            &lsaquo;
          </button>
          <button
            type="button"
            onClick={() => goTo(1)}
            aria-label="Next story"
            style={{
              position: "absolute",
              right: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              border: "1px solid rgba(201,87,106,0.6)",
              background: "rgba(8,10,18,0.55)",
              color: ACCENT,
              fontSize: "16px",
              lineHeight: 1,
              cursor: "pointer",
              boxShadow: "0 0 14px rgba(201,87,106,0.55)",
            }}
          >
            &rsaquo;
          </button>
        </>
      )}
      </div>

      {articles.length > 1 && (
        <div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
          {articles.slice(0, 8).map((a, i) => (
            <button
              key={a.id}
              onClick={() => setIndex(i)}
              aria-label={`Show story ${i + 1}`}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                padding: 0,
                background: i === index ? ACCENT : "var(--border)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, muted }: { label: string; value: number | string; sub: string; muted?: boolean }) {
  return (
    <div
      style={{
        padding: "16px 14px",
        borderRadius: "14px",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        textAlign: "center",
        opacity: muted ? 0.55 : 1,
      }}
    >
      <p style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.3rem", color: muted ? "var(--ink-dim)" : ACCENT }}>
        {value}
      </p>
      <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)" }}>
        {label}
      </p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: "8px", color: "var(--ink-faint, #5c6684)" }}>{sub}</p>}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "36px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.02rem", margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", fontSize: "0.9rem" }}>
      {children}
    </p>
  );
}

function ThreadList({ threads, authors }: { threads: CommonsThread[]; authors: Record<string, PublicProfile> }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
      {threads.map((t) => (
        <li key={t.id}>
          <Link
            href={`/commons/t/${t.id}`}
            style={{
              display: "block",
              padding: "14px 16px",
              borderRadius: "12px",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              textDecoration: "none",
              color: "var(--ink)",
            }}
          >
            <p style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.9rem" }}>
              {t.kind === "question" ? "? " : ""}
              {t.title}
            </p>
            <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.05em", color: "var(--ink-faint, #5c6684)" }}>
              <span style={{ color: authors[t.profile_id]?.commons_accent || undefined }}>{authorName(authors[t.profile_id])}</span> &middot; {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NewThreadForm({
  kind,
  setKind,
  title,
  setTitle,
  body,
  setBody,
  busy,
  error,
  onSubmit,
}: {
  kind: "discussion" | "question";
  setKind: (k: "discussion" | "question") => void;
  title: string;
  setTitle: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} style={{ marginBottom: "18px", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        {(["discussion", "question"] as const).map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => setKind(k)}
            style={{
              padding: "6px 12px",
              borderRadius: "999px",
              border: `1px solid ${kind === k ? ACCENT : "var(--border)"}`,
              background: kind === k ? `${ACCENT}22` : "transparent",
              color: kind === k ? ACCENT : "var(--ink-dim)",
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
        placeholder={kind === "question" ? "What do you want to understand?" : "What's on your mind?"}
        required
        style={{ ...inputStyle, marginBottom: "8px" }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Say more..."
        rows={3}
        required
        style={{ ...inputStyle, resize: "vertical" as const, marginBottom: "8px" }}
      />
      {error && <p style={errorStyle}>{error}</p>}
      <button type="submit" disabled={busy} style={submitButtonStyle}>
        {busy ? "Posting..." : "Post"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--void)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: "0.88rem",
};

const submitButtonStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: ACCENT,
  color: "#1a0d10",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "0.8rem",
  cursor: "pointer",
};

const communityActionStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid var(--gold)",
  background: "rgba(184,134,63,0.12)",
  color: "var(--gold)",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "0.8rem",
  letterSpacing: "0.04em",
  cursor: "pointer",
};

const smallActionStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  background: "none",
  color: "var(--ink-dim)",
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  textTransform: "uppercase",
  cursor: "pointer",
};

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: ACCENT,
  fontStyle: "italic",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
  fontFamily: "var(--font-body)",
  fontSize: "0.9rem",
};

const errorStyle: React.CSSProperties = {
  color: "#e0703a",
  fontSize: "0.8rem",
  fontFamily: "var(--font-body)",
  margin: "0 0 8px",
};
