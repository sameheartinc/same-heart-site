"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PageLoading from "@/components/PageLoading";
import { LinkEmbedPreview } from "@/components/LinkEmbedPreview";
import { ShareButton } from "@/components/ShareButton";
import { fetchProfilesByIds, type PublicProfile } from "@/lib/commons";
import { getTransmission, toggleResonance, type FeedTransmission } from "@/lib/exchange";
import { getWorldIssue } from "@/lib/worldIssues";

const ACCENT = "#c9576a";
const SITE_URL = "https://sameheart.ca";

// The public face of a single transmission -- no login wall, on
// purpose (see page.tsx's own comment). Reading is open to anyone;
// resonating still needs an account, same "browse freely, sign in the
// moment you want to do something" shape as Pinterest and Reddit that
// Rob asked for directly.
export default function TransmissionDetail({ transmissionId }: { transmissionId: string }) {
  const [loading, setLoading] = useState(true);
  const [transmission, setTransmission] = useState<FeedTransmission | null>(null);
  const [sender, setSender] = useState<PublicProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [reacting, setReacting] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: userData }, t] = await Promise.all([
        supabase.auth.getUser(),
        getTransmission(transmissionId),
      ]);
      setUserId(userData.user?.id ?? null);
      setTransmission(t);
      if (t) {
        const authors = await fetchProfilesByIds([t.profile_id]);
        setSender(authors[t.profile_id] ?? null);
      }
      setLoading(false);
    })();
  }, [transmissionId]);

  async function handleResonate() {
    if (!transmission) return;
    if (!userId) {
      window.location.href = `/login?next=${encodeURIComponent(`/commons/exchange/${transmission.id}`)}`;
      return;
    }
    if (reacting) return;
    setReacting(true);
    try {
      const result = await toggleResonance(transmission.id);
      setTransmission((prev) =>
        prev ? { ...prev, my_resonated: result.resonated, resonance_count: result.resonanceCount } : prev
      );
    } catch {
      // Best-effort -- leaves the row as it was.
    } finally {
      setReacting(false);
    }
  }

  if (loading) return <PageLoading />;

  if (!transmission) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--void)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 22px",
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)" }}>
            That transmission isn&rsquo;t here anymore.
          </p>
          <Link
            href="/commons"
            style={{ color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: "11px", textDecoration: "none" }}
          >
            &larr; Back to the Commons
          </Link>
        </div>
      </main>
    );
  }

  const issue = getWorldIssue(transmission.issue_key);
  const senderLabel = sender?.designation || sender?.display_name || "A Same Heart member";
  const date = new Date(transmission.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const shareUrl = `${SITE_URL}/commons/exchange/${transmission.id}`;
  const shareTitle = transmission.tagline || transmission.title || transmission.domain || "A transmission on Same Heart";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
        padding: "48px 22px 80px",
      }}
    >
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <Link
          href="/commons/exchange"
          style={{
            color: "var(--ink-faint, #5c6684)",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          &larr; The Exchange Feed
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
            fontSize: "1.4rem",
            margin: "0 0 6px",
            lineHeight: 1.3,
          }}
        >
          {transmission.title || transmission.domain || transmission.url}
        </h1>

        <p
          style={{
            margin: "0 0 20px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--ink-faint, #a29cb0)",
          }}
        >
          {senderLabel} &middot; {date} &middot; {transmission.impact_score ?? 0}/100
        </p>

        {transmission.tagline && (
          <p
            style={{
              margin: "0 0 18px",
              color: "var(--ink-dim)",
              fontStyle: "italic",
              fontSize: "1.02rem",
            }}
          >
            &ldquo;{transmission.tagline}&rdquo;
          </p>
        )}

        <LinkEmbedPreview url={transmission.url} showLabel={false} />

        {!transmission.title?.length && transmission.image_url && (
          <img
            src={transmission.image_url}
            alt=""
            style={{
              width: "100%",
              maxWidth: "420px",
              borderRadius: "10px",
              objectFit: "cover",
              border: "1px solid var(--border)",
              marginBottom: "18px",
            }}
          />
        )}

        <a
          href={transmission.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginBottom: "24px",
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            textDecoration: "none",
            wordBreak: "break-all",
          }}
        >
          {transmission.url} &rarr;
        </a>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            padding: "14px 16px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            background: "var(--panel)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {issue && (
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
            )}
            <button
              type="button"
              onClick={handleResonate}
              disabled={reacting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "999px",
                border: `1px solid ${transmission.my_resonated ? ACCENT : "var(--border)"}`,
                background: transmission.my_resonated ? "rgba(201,87,106,0.1)" : "var(--void)",
                color: transmission.my_resonated ? ACCENT : "var(--ink-dim)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                cursor: reacting ? "default" : "pointer",
                opacity: reacting ? 0.6 : 1,
              }}
            >
              <span aria-hidden="true">{transmission.my_resonated ? "♥" : "♡"}</span>
              {transmission.resonance_count > 0 ? transmission.resonance_count : "Resonate"}
            </button>
          </div>
          <ShareButton
            url={shareUrl}
            title={shareTitle}
            text="Transmitted through Same Heart's Exchange"
          />
        </div>
      </div>
    </main>
  );
}
