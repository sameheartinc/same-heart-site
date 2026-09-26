import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripeServer } from "@/lib/stripeServer";

// Starts a sponsorship: creates a 'pending' row (never trusted as real
// until app/api/sponsor/webhook/route.ts hears back from Stripe), then a
// Stripe Checkout Session for the tier's REAL price read fresh from the
// database -- the client never gets to say how much it's paying, only
// which tier it wants. The logo, if any, is uploaded here server-side
// (see supabase/schema.sql's sponsor-logos bucket, which has no public
// insert policy at all) rather than exposing an open anonymous upload
// endpoint.
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const SITE_URL = "https://sameheart.ca";

export async function POST(request: NextRequest) {
  const admin = supabaseAdmin();

  let campaignId: string;
  let tierId: string;
  let businessName: string;
  let contactEmail: string;
  let website: string;
  let logo: File | null;
  try {
    const form = await request.formData();
    campaignId = String(form.get("campaignId") ?? "");
    tierId = String(form.get("tierId") ?? "");
    businessName = String(form.get("businessName") ?? "").trim();
    contactEmail = String(form.get("contactEmail") ?? "").trim();
    website = String(form.get("website") ?? "").trim();
    const logoEntry = form.get("logo");
    logo = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;
  } catch {
    return NextResponse.json({ error: "Couldn't read that request." }, { status: 400 });
  }

  if (!campaignId || !tierId || !businessName || !contactEmail) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json({ error: "That doesn't look like a real email address." }, { status: 400 });
  }
  if (logo) {
    if (logo.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo file is too large -- 5MB max." }, { status: 400 });
    }
    if (!ALLOWED_LOGO_TYPES.has(logo.type)) {
      return NextResponse.json({ error: "Logo must be a PNG, JPEG, WebP, or SVG." }, { status: 400 });
    }
  }

  const { data: campaign, error: campaignError } = await admin
    .from("sponsor_campaigns")
    .select("id, title, status, slug")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError || !campaign || campaign.status !== "active") {
    return NextResponse.json({ error: "That campaign isn't accepting sponsors right now." }, { status: 400 });
  }

  const { data: tier, error: tierError } = await admin
    .from("sponsor_tiers")
    .select("id, name, price_cents")
    .eq("id", tierId)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (tierError || !tier) {
    return NextResponse.json({ error: "That sponsorship tier doesn't exist." }, { status: 400 });
  }

  let logoUrl: string | null = null;
  if (logo) {
    const ext = logo.name.split(".").pop() || "png";
    const path = `${campaignId}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("sponsor-logos")
      .upload(path, logo, { contentType: logo.type });
    if (uploadError) {
      console.error("Sponsor logo upload failed:", uploadError.message);
      // Not a fatal error -- a sponsorship without a logo yet is still a real sponsorship.
    } else {
      const { data: publicUrlData } = admin.storage.from("sponsor-logos").getPublicUrl(path);
      logoUrl = publicUrlData.publicUrl;
    }
  }

  const { data: sponsorship, error: insertError } = await admin
    .from("sponsorships")
    .insert({
      campaign_id: campaignId,
      tier_id: tierId,
      business_name: businessName,
      contact_email: contactEmail,
      website: website || null,
      logo_url: logoUrl,
      amount_cents: tier.price_cents,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !sponsorship) {
    console.error("Sponsorship insert failed:", insertError?.message);
    return NextResponse.json({ error: "Couldn't start that -- try again in a moment." }, { status: 503 });
  }

  try {
    const stripe = stripeServer();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: contactEmail,
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: tier.price_cents,
            product_data: {
              name: `${campaign.title} -- ${tier.name} Sponsorship`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { sponsorship_id: sponsorship.id },
      success_url: `${SITE_URL}/sponsor/thank-you?sponsorship=${sponsorship.id}`,
      cancel_url: `${SITE_URL}/sponsor/${campaign.slug}`,
    });

    await admin.from("sponsorships").update({ stripe_checkout_session_id: session.id }).eq("id", sponsorship.id);

    if (!session.url) {
      return NextResponse.json({ error: "Couldn't start checkout -- try again." }, { status: 503 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session failed:", err);
    return NextResponse.json(
      { error: "Sponsorship checkout isn't switched on yet -- ask the site owner to finish its setup." },
      { status: 503 }
    );
  }
}
