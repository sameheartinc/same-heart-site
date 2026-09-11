"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ensureSession } from "../../lib/session";
import {
  Campaign,
  createCampaign,
  generateCampaignSuggestions,
  listActiveCampaigns,
  saveCampaignSuggestions,
} from "../../lib/campaigns";
import { loadStoredPath } from "../../lib/localState";
import { PATHS, PathKey } from "../../lib/paths";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    listActiveCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      setSubmitStep("Signing you in...");
      await ensureSession();

      setSubmitStep("Saving your cause...");
      const stored = loadStoredPath();
      const campaign = await createCampaign({
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || undefined,
        pathKey: (stored?.path as PathKey) ?? null,
      });

      setSubmitStep("Scanning for signal...");
      const suggestions = await generateCampaignSuggestions(campaign);

      setSubmitStep("Logging the transmission...");
      await saveCampaignSuggestions(campaign.id, suggestions);

      window.location.href = `/campaigns/${campaign.id}`;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
      setSubmitStep("");
    }
  }

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
          color: "var(--gold)",
          marginBottom: "10px",
        }}
      >
        Same Heart&trade; &middot; Campaigns
      </p>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(1.8rem, 5vw, 2.6rem)",
          margin: "0 0 12px",
        }}
      >
        Someone wants to bring sandwiches to the homeless.
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontStyle: "italic",
          color: "var(--ink-dim)",
          maxWidth: "56ch",
          margin: "0 0 28px",
        }}
      >
        That someone could be you. Say what you want to do, and your ship
        picks up real signal in return -- current news, local groups already
        doing it, and exactly what to say.
      </p>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            background: "var(--gold)",
            border: "none",
            borderRadius: "999px",
            padding: "12px 24px",
            color: "var(--void)",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "36px",
          }}
        >
          Start a campaign
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: "12px",
            background: "var(--panel)",
            border: "1px solid #313f5e",
            borderRadius: "18px",
            padding: "22px",
            marginBottom: "40px",
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to do? (e.g. Bring sandwiches to the homeless)"
            required
            style={inputStyle}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Say more -- how often, why this matters to you, what help you need..."
            required
            rows={4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-body)" }}
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional, e.g. Toronto, ON)"
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "var(--gold)",
                border: "none",
                borderRadius: "999px",
                padding: "12px 22px",
                color: "var(--void)",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Working..." : "Pick up the signal"}
            </button>
            {submitStep && (
              <span style={{ color: "var(--ink-dim)", fontSize: "0.9rem" }}>{submitStep}</span>
            )}
          </div>
          {errorMessage && (
            <p style={{ color: "var(--rose)", fontSize: "0.9rem", margin: 0 }}>{errorMessage}</p>
          )}
        </form>
      )}

      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "13px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-dim)",
          marginBottom: "16px",
        }}
      >
        Active campaigns
      </h2>

      {loading && <p style={{ color: "var(--ink-dim)" }}>Loading...</p>}
      {!loading && campaigns.length === 0 && (
        <p style={{ color: "var(--ink-dim)" }}>
          None yet -- be the first to start one.
        </p>
      )}

      <div style={{ display: "grid", gap: "12px" }}>
        {campaigns.map((c) => {
          const accent = c.pathKey ? PATHS[c.pathKey as PathKey]?.accent : "var(--gold)";
          return (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              style={{
                display: "block",
                background: "var(--panel)",
                border: `1px solid ${accent}55`,
                borderRadius: "14px",
                padding: "16px 18px",
                textDecoration: "none",
                color: "var(--ink)",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>{c.title}</p>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "var(--ink-dim)",
                  fontSize: "0.9rem",
                }}
              >
                {c.location ? `${c.location} · ` : ""}
                {c.description.slice(0, 100)}
                {c.description.length > 100 ? "..." : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--void)",
  border: "1px solid #313f5e",
  borderRadius: "10px",
  padding: "12px 14px",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: "0.95rem",
};
