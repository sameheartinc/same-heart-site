"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageLoading from "@/components/PageLoading";
import {
  getCampaign,
  listTiers,
  listSponsors,
  fetchRaisedCents,
  startCheckout,
  type SponsorCampaign,
  type SponsorTier,
  type PublicSponsorship,
} from "@/lib/sponsorship";

const ACCENT = "#c9576a";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

// A public sponsorship campaign page (Sep 22, 2026) -- businesses
// sponsor a Same Heart initiative for real visibility, not a charitable
// tax receipt (see lib/sponsorship.ts's header for the full trust
// model). No sign-in needed to view or sponsor -- this is a business
// transaction with the company, not a member action.
export default function SponsorCampaignPage({ params }: { params: { slug: string } }) {
  const [checking, setChecking] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [campaign, setCampaign] = useState<SponsorCampaign | null>(null);
  const [tiers, setTiers] = useState<SponsorTier[]>([]);
  const [sponsors, setSponsors] = useState<PublicSponsorship[]>([]);
  const [raisedCents, setRaisedCents] = useState(0);

  const [openTierId, setOpenTierId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const c = await getCampaign(params.slug);
      if (!c) {
        setNotFound(true);
        setChecking(false);
        return;
      }
      setCampaign(c);
      const [t, s, raised] = await Promise.all([listTiers(c.id), listSponsors(c.id), fetchRaisedCents(c.id)]);
      setTiers(t);
      setSponsors(s);
      setRaisedCents(raised);
      setChecking(false);
    })();
  }, [params.slug]);

  async function handleSponsor(e: React.FormEvent, tier: SponsorTier) {
    e.preventDefault();
    if (!campaign || !businessName.trim() || !contactEmail.trim()) return;
    setBusy(true);
    setFormError(null);
    const result = await startCheckout({
      campaignId: campaign.id,
      tierId: tier.id,
      businessName: businessName.trim(),
      contactEmail: contactEmail.trim(),
      website: website.trim() || undefined,
      logoFile,
    });
    if (result.ok && result.url) {
      window.location.href = result.url;
      return;
    }
    setFormError(result.error || "Couldn't start checkout -- try again.");
    setBusy(false);
  }

  if (checking) return <PageLoading />;

  if (notFound || !campaign) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--void)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-dim)", marginBottom: "16px" }}>
            That campaign doesn&rsquo;t exist yet.
          </p>
          <Link href="/" style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.85rem" }}>
            &larr; Same Heart
          </Link>
        </div>
      </main>
    );
  }

  const progressPct = campaign.goal_cents > 0 ? Math.min(100, Math.round((raisedCents / campaign.goal_cents) * 100)) : 0;

  return (
    <main style={{ minHeight: "100vh", background: "var(--void)", color: "var(--ink)", padding: "48px 22px 90px" }}>
      <div style={{ maxWidth: "820px", margin: "0 auto" }}>
        <Link href="/" style={{ color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: "0.82rem", textDecoration: "none" }}>
          &larr; Same Heart
        </Link>

        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.9rem", margin: "20px 0 12px" }}>
          {campaign.title}
        </h1>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--ink-dim)", lineHeight: 1.7, maxWidth: "68ch", margin: "0 0 24px" }}>
          {campaign.description}
        </p>

        <div style={{ marginBottom: "34px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink-dim)", marginBottom: "6px" }}>
            <span>{formatCents(raisedCents)} raised</span>
            <span>Goal: {formatCents(campaign.goal_cents)}</span>
          </div>
          <div style={{ height: "10px", borderRadius: "999px", background: "var(--border)", overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: ACCENT, transition: "width 0.6s ease" }} />
          </div>
        </div>

        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.1rem", margin: "0 0 14px" }}>
          Sponsor this campaign
        </h2>
        <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-faint, #5c6684)", fontSize: "0.82rem", maxWidth: "60ch", margin: "0 0 20px" }}>
          This is a sponsorship, not a charitable donation -- Same Heart Inc. is a company, not a
          registered charity, so no tax receipt is issued. Sponsors are recognized publicly below.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "40px" }}>
          {tiers.map((tier) => (
            <div key={tier.id} style={{ padding: "20px", borderRadius: "14px", border: `1px solid ${openTierId === tier.id ? ACCENT : "var(--border)"}`, background: "var(--panel)" }}>
              <p style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>{tier.name}</p>
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-mono)", fontSize: "1.3rem", color: ACCENT }}>{formatCents(tier.price_cents)}</p>
              <ul style={{ margin: "0 0 16px", padding: "0 0 0 18px", fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--ink-dim)" }}>
                {tier.perks.map((perk) => (
                  <li key={perk} style={{ marginBottom: "4px" }}>{perk}</li>
                ))}
              </ul>
              {openTierId === tier.id ? (
                <form onSubmit={(e) => handleSponsor(e, tier)}>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Business name"
                    required
                    style={inputStyle}
                  />
                  <input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Contact email"
                    type="email"
                    required
                    style={inputStyle}
                  />
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="Website (optional)"
                    type="url"
                    style={inputStyle}
                  />
                  <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-faint, #5c6684)", margin: "4px 0 6px" }}>
                    Logo (optional)
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                    style={{ marginBottom: "10px", fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "var(--ink-dim)" }}
                  />
                  {formError && <p style={{ color: "#e0703a", fontSize: "0.78rem", margin: "0 0 8px" }}>{formError}</p>}
                  <button type="submit" disabled={busy} style={submitStyle}>
                    {busy ? "Starting checkout..." : `Sponsor for ${formatCents(tier.price_cents)}`}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpenTierId(tier.id);
                    setFormError(null);
                  }}
                  style={submitStyle}
                >
                  Choose {tier.name}
                </button>
              )}
            </div>
          ))}
        </div>

        {sponsors.length > 0 && (
          <>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.1rem", margin: "0 0 14px" }}>
              Our sponsors
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              {sponsors.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--panel)" }}>
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo_url} alt={s.business_name} style={{ height: "28px", maxWidth: "120px", objectFit: "contain" }} />
                  ) : null}
                  {s.website ? (
                    <a href={s.website} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.85rem", color: "var(--ink)" }}>
                      {s.business_name}
                    </a>
                  ) : (
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.85rem" }}>{s.business_name}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--void)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  marginBottom: "8px",
};

const submitStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: ACCENT,
  color: "#fff",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
};
