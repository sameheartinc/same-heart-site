import { supabase } from "@/lib/supabaseClient";

// Same Heart -- sponsorship campaigns (Sep 22, 2026). Businesses sponsor
// a Same Heart initiative for real visibility -- a marketing expense for
// them, not a charitable tax receipt (Same Heart Inc. is a company, not
// a registered charity). See supabase/schema.sql's sponsor_campaigns/
// sponsor_tiers/sponsorships tables for the full trust model: reading is
// open to everyone, but a sponsorship only ever becomes "paid" once
// Stripe itself confirms the charge (app/api/sponsor/webhook/route.ts),
// never from anything this file or its caller claims.

export interface SponsorCampaign {
  id: string;
  slug: string;
  title: string;
  description: string;
  goal_cents: number;
  hero_image_url: string | null;
  status: "draft" | "active" | "completed";
}

export interface SponsorTier {
  id: string;
  campaign_id: string;
  name: string;
  price_cents: number;
  perks: string[];
  sort_order: number;
}

export interface PublicSponsorship {
  id: string;
  campaign_id: string;
  tier_id: string | null;
  business_name: string;
  website: string | null;
  logo_url: string | null;
  amount_cents: number;
  paid_at: string;
}

export async function getCampaign(slug: string): Promise<SponsorCampaign | null> {
  const { data, error } = await supabase.from("sponsor_campaigns").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return data as SponsorCampaign;
}

export async function listTiers(campaignId: string): Promise<SponsorTier[]> {
  const { data, error } = await supabase
    .from("sponsor_tiers")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as SponsorTier[];
}

// Real paid sponsors only -- public_sponsorships already filters to
// status = 'paid' and never carries contact_email (see schema.sql).
export async function listSponsors(campaignId: string): Promise<PublicSponsorship[]> {
  const { data, error } = await supabase
    .from("public_sponsorships")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("amount_cents", { ascending: false });
  if (error || !data) return [];
  return data as PublicSponsorship[];
}

// The real, honest progress number -- a plain sum of what's actually
// been paid, same "no simulated counts" posture as fetchCommonsStats.
export async function fetchRaisedCents(campaignId: string): Promise<number> {
  const { data, error } = await supabase
    .from("public_sponsorships")
    .select("amount_cents")
    .eq("campaign_id", campaignId);
  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + (row.amount_cents as number), 0);
}

// Kicks off checkout: uploads the optional logo and creates a pending
// sponsorship server-side (app/api/sponsor/checkout/route.ts), which
// hands back a Stripe Checkout URL to redirect to. Nothing here decides
// a price -- the server re-reads the tier's real price itself.
export async function startCheckout(input: {
  campaignId: string;
  tierId: string;
  businessName: string;
  contactEmail: string;
  website?: string;
  logoFile?: File | null;
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const form = new FormData();
    form.set("campaignId", input.campaignId);
    form.set("tierId", input.tierId);
    form.set("businessName", input.businessName);
    form.set("contactEmail", input.contactEmail);
    if (input.website) form.set("website", input.website);
    if (input.logoFile) form.set("logo", input.logoFile);

    const res = await fetch("/api/sponsor/checkout", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || "Couldn't start checkout -- try again." };
    return { ok: true, url: json.url };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Try again in a moment." };
  }
}
