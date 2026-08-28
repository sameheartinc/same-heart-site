"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import CommonsSphere from "@/components/CommonsSphere";
import {
  authorName,
  createCommunity,
  createThread,
  fetchCommonsStats,
  fetchProfilesByIds,
  fetchSignal,
  listCommunities,
  listThreads,
  touchPresence,
  type Community,
  type CommonsThread,
  type NewsArticle,
  type PublicProfile,
} from "@/lib/commons";

const SEEN_KEY = "commons-entrance-seen";
const ACCENT = "#c9576a";

export default function CommonsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [stage, setStage] = useState<"entrance" | "home">("entrance");
  const [entranceStep, setEntranceStep] = useState(0);
  const [pendingQuery, setPendingQuery] = useState("");

  const [stats, setStats] = useState({ humansPresent: 0, communitiesActive: 0, activeConversations: 0 });
  const [signal, setSignal] = useState<NewsArticle[]>([]);
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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      touchPresence(data.user.id); // fire-and-forget -- don't block the first paint on this
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
    const [statsData, communitiesData, live, questions, signalData] = await Promise.all([
      fetchCommonsStats(),
      listCommunities(),
      listThreads({ limit: 6 }),
      listThreads({ kind: "question", limit: 6 }),
      fetchSignal(8),
    ]);
    setStats(statsData);
    setCommunities(communitiesData);
    setLiveThreads(live);
    setQuestionThreads(questions);
    setSignal(signalData);

    const ids = [
      ...communitiesData.map((c) => c.created_by),
      ...live.map((t) => t.profile_id),
      ...questions.map((t) => t.profile_id),
    ];
    setAuthors(await fetchProfilesByIds(ids));
  }, []);

  useEffect(() => {
    if (stage === "home") loadHome();
  }, [stage, loadHome]);

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
    <main style={{ minHeight: "100vh", background: "var(--void)", color: "var(--ink)", padding: "40px 20px 90px" }}>
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

        {!showingSearch && signal.length > 0 && <SignalBubble articles={signal} />}

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
          <StatCard label="Communities" value={stats.communitiesActive} sub="" />
          <StatCard label="Projects" value="Not open yet" sub="" muted />
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
            {signal.length > 0 && (
              <Section title="The Signal">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {signal.map((article) => (
                    <a
                      key={article.id}
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
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
                          background: article.image_url
                            ? `center/cover no-repeat url(${article.image_url})`
                            : "linear-gradient(135deg, var(--void), var(--panel))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {!article.image_url && (
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
                  ))}
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

            <Section
              title="Communities"
              action={
                <button onClick={() => setNewCommunityOpen((v) => !v)} style={smallActionStyle}>
                  {newCommunityOpen ? "Cancel" : "+ Start a community"}
                </button>
              }
            >
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
          backed by the database, nothing simulated. What's not built
          yet: live group chat, AI-assisted analysis and the Commons
          Guide, Projects, Exchange impact-tracking, and the full 3D
          scanned-room experience from the original vision. Those are
          real, tracked next phases -- not forgotten, just not here
          today.
        </p>
      </div>
    </main>
  );
}

function SignalBubble({ articles }: { articles: NewsArticle[] }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (articles.length <= 1) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % articles.length);
        setFading(false);
      }, 380);
    }, 6500);
    return () => clearInterval(id);
  }, [articles.length]);

  if (articles.length === 0) return null;
  const article = articles[Math.min(index, articles.length - 1)];

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

      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="signal-bubble"
        style={{
          position: "relative",
          width: "min(460px, 88vw)",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          overflow: "hidden",
          textDecoration: "none",
          display: "block",
          background: article.image_url
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
          style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 26px rgba(0,0,0,0.55)", borderRadius: "50%" }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "30px 28px 34px",
            background: "linear-gradient(to top, rgba(8,10,18,0.94), rgba(8,10,18,0) 72%)",
          }}
        >
          <p
            style={{
              margin: "0 0 4px",
              fontFamily: "var(--font-body)",
              fontSize: "1.05rem",
              fontWeight: 600,
              color: "#fff",
              lineHeight: 1.25,
              display: "-webkit-box",
              WebkitLineClamp: 3,
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
              fontSize: "10px",
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
              {authorName(authors[t.profile_id])} &middot; {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
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
