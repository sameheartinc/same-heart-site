import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripeServer } from "@/lib/stripeServer";

// The only place a sponsorship is ever marked 'paid' -- Stripe calls
// this directly (not the browser), with a signature verified against
// STRIPE_WEBHOOK_SECRET, so a pending sponsorship can never be flipped
// to paid by anything the client sends. Configure this URL
// (https://sameheart.ca/api/sponsor/webhook) in the Stripe Dashboard --
// Developers -> Webhooks -- listening for checkout.session.completed.
//
// Idempotent on purpose: Stripe retries webhook delivery, so this only
// ever updates a sponsorship that's still 'pending' -- a second delivery
// of the same event finds nothing left to update and does nothing.
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Sponsor webhook: STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event;
  try {
    event = stripeServer().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Sponsor webhook: signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string; metadata?: { sponsorship_id?: string } };
    const sponsorshipId = session.metadata?.sponsorship_id;
    if (sponsorshipId) {
      const admin = supabaseAdmin();
      const { error } = await admin
        .from("sponsorships")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", sponsorshipId)
        .eq("status", "pending");
      if (error) {
        console.error("Sponsor webhook: failed to mark sponsorship paid:", error.message);
        return NextResponse.json({ error: "Couldn't record payment." }, { status: 503 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
