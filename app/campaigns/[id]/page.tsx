"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ensureSession } from "../../../lib/session";
import { Campaign, getCampaign } from "../../../lib/campaigns";
import { PATHS, PathKey } from "../../../lib/paths";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ensureSession().catch(() => {});
    getCampaign(params.id)
      .then(setCampaign)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-dim)" }}>
        Loading...
      </main>
    );
  }

  if (!campaign) {
    return (
      <main style={{ padding: "48px 24px", textAlign: "center" }}>
        <p>Campaign not found.</p>
      </main>
    );
  }

  const accent = campaign.pathKey ? PATHS[campaign.pathKey as PathKey]?.accent : "#c9a15a";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 24px",
        maxWidth: "760px",
        margin: "0 auto",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "11px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: "10px",
        }}
      >
        Same Heart&trade; &middot; Campaign
      </p>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(1.8rem, 5vw, 2.6rem)",
          margin: "0 0 12px",
        }}
      >
        {campaign.title}
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--ink-dim)",
          maxWidth: "60ch",
          marginBottom: "8px",
        }}
      >
        {campaign.description}
      </p>
      {campaign.location && (
        <p style={{ color: "var(--ink-dim)", fontSize: "0.85rem" }}>{campaign.location}</p>
      )}

      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "13px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-dim)",
          margin: "36px 0 4px",
        }}
      >
        Ship Communications
      </h2>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontStyle: "italic",
          color: "var(--ink-dim)",
          fontSize: "0.85rem",
          margin: "0 0 16px",
        }}
      >
        Picked up in real time, from wherever the signal is coming from.
      </p>

      {campaign.suggestions.length === 0 && (
        <p style={{ color: "var(--ink-dim)" }}>No transmissions yet.</p>
      )}

      <div style={{ display: "grid", gap: "16px" }}>
        {campaign.suggestions.map((s, i) => (
          <div
            key={i}
            style={{
              background: "var(--panel)",
              border: `1px solid ${accent}44`,
              borderRadius: "16px",
              padding: "18px 20px",
            }}
          >
            <p
              style={{
                margin: "0 0 4px",
                fontFamily: "var(--font-display)",
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: accent,
              }}
            >
              {s.channel_type.replace(/_/g, " ")}
            </p>
            <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--ink)" }}>
                  {s.channel_name} &#8599;
                </a>
              ) : (
                s.channel_name
              )}
            </p>
            <p style={{ color: "var(--ink-dim)", fontSize: "0.88rem", margin: "0 0 10px" }}>
              {s.reasoning}
            </p>
            <p
              style={{
                background: "var(--void)",
                borderRadius: "10px",
                padding: "12px 14px",
                fontSize: "0.9rem",
                fontStyle: "italic",
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {s.draft_copy}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
