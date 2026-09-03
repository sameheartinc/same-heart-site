// Founding rewards -- Rob's Sep 3 2026 request: the first 100 people to
// legitimately sign up and verify their email get a real prize, and the
// first 1000 get a store discount.
//
// "Legitimately" matters here because sign-up on Same Heart is two steps:
// everyone gets an anonymous session the instant they arrive (see
// lib/session.ts's ensureSession()), and only later -- via the sign-up
// form or "Claim your account" -- do they attach a real email/password.
// Ranking by raw account creation would let someone hoard early numbers
// with throwaway anonymous sessions that never become real people. So
// this ranks by VERIFIED EMAIL order instead: the moment
// auth.users.email_confirmed_at first gets set (handled by the new
// on_auth_user_email_confirmed trigger in supabase/schema.sql), a
// profile gets a permanent, sequential verified_rank -- same "first
// member is first, forever" idea spark_id already uses for join order,
// just keyed to a real verified account instead of a raw signup.
//
// Sign-up already runs behind Cloudflare Turnstile (see
// lib/turnstile.ts / app/login/page.tsx) as a first line of defense
// against bot/script signups trying to game this. Worth knowing about,
// not built here: a disposable-email-domain blocklist would close the
// remaining gap (someone using a real but throwaway inbox just to
// verify and grab a slot) -- logged as a future option in IDEAS.md,
// not built since Rob didn't ask for it specifically.

export const FOUNDER_PRIZE_LIMIT = 100;
export const FOUNDING_1000_LIMIT = 1000;

// These are shown directly to whoever qualifies, so they are not
// secrets -- fine to keep as plain constants here rather than an env
// var. REPLACE both once the real codes exist in Shopify (Shopify
// Admin -> Discounts -> Create discount -- a plain percentage-off or
// free-item code works, no Shopify Admin API access needed for this
// "one shared code" approach).
export const FOUNDER_PRIZE_CODE = "FOUNDER100-COMING-SOON";
export const FOUNDING_1000_CODE = "FOUNDING1000-COMING-SOON";

// What the first 100 actually get is still undecided (Rob's call,
// Sep 3 2026: "store credit, automatic" was the direction, exact
// amount/mechanism not chosen yet). This copy is deliberately generic
// until that's settled -- update it here once it is.
export const FOUNDER_PRIZE_DESCRIPTION = "a founding member reward";

export type FounderTier = "prize" | "discount";

export interface FounderStatus {
  rank: number;
  tier: FounderTier;
  code: string;
  label: string;
}

// null input covers both "hasn't verified yet" and "verified after the
// first 1000" -- both render nothing, same as today.
export function founderStatus(verifiedRank: number | null | undefined): FounderStatus | null {
  if (!verifiedRank || verifiedRank < 1) return null;
  if (verifiedRank <= FOUNDER_PRIZE_LIMIT) {
    return {
      rank: verifiedRank,
      tier: "prize",
      code: FOUNDER_PRIZE_CODE,
      label: `Founding Member #${verifiedRank}`,
    };
  }
  if (verifiedRank <= FOUNDING_1000_LIMIT) {
    return {
      rank: verifiedRank,
      tier: "discount",
      code: FOUNDING_1000_CODE,
      label: `Founding Member #${verifiedRank}`,
    };
  }
  return null;
}
