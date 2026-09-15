"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import { LinkEmbedPreview } from "@/components/LinkEmbedPreview";
import { fetchProfilesByIds, type PublicProfile } from "@/lib/commons";
import { listExchangeFeed, toggleResonance, type FeedTransmission } from "@/lib/exchange";
import { getWorldIssue } from "@/lib/worldIssues";

const ACCENT = "#c9576a";

// The Exchange Feed -- Rob, Sep 15 2026, reversing the Sep 5 "not a list
// underneath" call: "bring back a visible feed... a real list of
// transmissions that anyone can browse, plus a lightweight way to
// react." Every transmission shows here, oldest to newest, not just the
// ones that clear the 70-score bar for the rotating bubble on the
// Commons homepage -- this is meant to be the honest, complete record,
// not a curated highlight reel. No score floor was added on purpose;
// if it turns out low-scoring noise clutters this in practice, that's a
// real call to make later, not one to guess at now.
//
// "Resonate" is a light heart-tap, not a second reward economy -- it
// never awards Heartbeats to the sender or the person reacting. It's
// purely social: a way for a link to visibly matter to more than one
// person instead of disappearing the moment it's scored. See
// toggle_transmission_resonance in supabase/schema.sql.
export default function ExchangePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedTransmission[]>([]);
  const [authors, setAuthors] = useState<Record<string, PublicProfile>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [limit, setLimit] = useState(40);
  const [reactingId, setReactingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      setChecking(false);

      const rows = await listExchangeFeed(limit);
      setFeed(rows);
      setAuthors(await fetchProfilesByIds(rows.map((r) => r.profile_id)));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadMore() {
    setLoadingMore(true);
    const nextLimit = limit + 40;
    const rows = await listExchangeFeed(nextLimit);
    const newAuthors = await fetchProfilesByIds(rows.map((r) => r.profile_id));
    setFeed(rows);
    setAuthors((prev) => ({ ...prev, ...newAuthors }));
    setLimit(nextLimit);
    setLoadingMore(false);
  }

  async function handleResonate(transmissionId: string) {
    if (reactingId) return;
    setReactingId(transmissionId);
    try {
      const result = await toggleResonance(transmissionId);
      setFeed((prev) =>
        prev.map((t) =>
          t.id === transmissionId
            ? { ...t, my_resonated: result.resonated, resonance_count: result.resonanceCount }
            : t
        )
      );
    } catch {
      // Best-effort -- a failed reaction just leaves the row as it was.
    } finally {
      setReactingId(null);
    }
  }

  if (checking) return <PageLoading />;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <Link
          href="/commons"
          style={{
            color: "var(--ink-faint, #5c6684)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; Back to the Commons
        </Link>

        <p
          style={{
            margin: "22px 0 6px",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          Comms Deck &middot; The Exchange
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.6rem",
            margin: "0 0 8px",
          }}
        >
          The Feed
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-dim)",
            fontSize: "0.9rem",
            margin: "0 0 30px",
            maxWidth: "56ch",
          }}
        >
          Everything transmitted through the Exchange, newest first -- real links, weighed
          against real issues. Tap the heart if one lands for you too.
        </p>

        {loading ? null : feed.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)" }}>
            Nothing transmitted yet -- be the first signal.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {feed.map((t) => {
              const issue = getWorldIssue(t.issue_key);
              const sender = authors[t.profile_id];
              const senderLabel = sender?.designation || sender?.display_name || "A Same Heart member";
              const isSelf = t.profile_id === userId;
              const date = new Date(t.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  key={t.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    background: "var(--panel)",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--ink-faint, #a29cb0)",
                      }}
                    >
                      {senderLabel}
                      {isSelf && " (you)"} &middot; {date}
                    </p>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "var(--gold)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.impact_score ?? 0}/100 &middot; +{t.heartbeats_awarded} Heartbeats
                    </span>
                  </div>

                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      margin: "6px 0 0",
                      color: "var(--ink)",
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "0.98rem",
                      textDecoration: "none",
                    }}
                  >
                    {t.title || t.domain || t.url}
                  </a>

                  {t.tagline && (
                    <p style={{ margin: "6px 0 0", color: "var(--ink-dim)", fontStyle: "italic" }}>
                      &ldquo;{t.tagline}&rdquo;
                    </p>
                  )}

                  <div style={{ marginTop: "10px" }}>
                    <LinkEmbedPreview url={t.url} showLabel={false} />
                  </div>

                  {!t.title?.length && t.image_url && (
                    <img
                      src={t.image_url}
                      alt=""
                      style={{
                        marginTop: "8px",
                        width: "100px",
                        height: "100px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        border: "1px solid var(--border)",
                      }}
                    />
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      marginTop: "10px",
                    }}
                  >
                    {issue ? (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "var(--ink-faint, #a29cb0)",
                        }}
                      >
                        {issue.label}
                      </span>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={() => handleResonate(t.id)}
                      disabled={reactingId === t.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        border: `1px solid ${t.my_resonated ? ACCENT : "var(--border)"}`,
                        background: t.my_resonated ? "rgba(201,87,106,0.1)" : "var(--void)",
                        color: t.my_resonated ? ACCENT : "var(--ink-dim)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        cursor: reactingId === t.id ? "default" : "pointer",
                        opacity: reactingId === t.id ? 0.6 : 1,
                      }}
                    >
                      <span aria-hidden="true">{t.my_resonated ? "♥" : "♡"}</span>
                      {t.resonance_count > 0 ? t.resonance_count : "Resonate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && feed.length >= limit && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              display: "block",
              margin: "22px auto 0",
              padding: "10px 20px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--panel)",
              color: "var(--ink)",
              fontFamily: "var(--font-display)",
              fontSize: "0.8rem",
              cursor: loadingMore ? "default" : "pointer",
              opacity: loadingMore ? 0.6 : 1,
            }}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </main>
  );
}
