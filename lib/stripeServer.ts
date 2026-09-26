import Stripe from "stripe";

// Server-only Stripe client -- mirrors lib/supabaseAdmin.ts's shape.
// Never import this from a "use client" file; the secret key must stay
// on the server. Requires STRIPE_SECRET_KEY (see .env.example).
export function stripeServer(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(secretKey);
}
