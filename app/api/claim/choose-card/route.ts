import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CARDS } from "@/lib/cards";

// Writes profiles.claim_card_choice -- the one thing that makes the
// claim-choice cards in lib/cards.ts (CLAIM_CHOICE_CARD_IDS) eligible in
// lib/evolution.ts. This route only ever records WHICH one someone
// picked; it never inserts into profile_unlocks itself -- the normal
// Evolution flow (evaluateEvolution(), already called on every Hub
// load) grants the actual card the next time it runs, same trust model
// as everything else in Evolution: nothing here is believed without a
// server-side re-check.
//
// Called once, right after a successful "Claim your account" submit
// (see app/login/page.tsx's "choose-card" stage) -- claiming and
// choosing are two steps of one moment, but two different writes:
// supabase.auth.updateUser() (the claim itself) happens client-side
// against the user's own session, while this is the one write that
// needs the service role, since profiles.claim_card_choice is
// column-locked against the authenticated role (see supabase/schema.sql).

const CLAIM_CHOICE_IDS = new Set(
  CARDS.filter((c) => c.source.type === "claim-choice").map((c) => c.id)
);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cardId = typeof body?.cardId === "string" ? body.cardId : null;
  if (!cardId || !CLAIM_CHOICE_IDS.has(cardId)) {
    return NextResponse.json({ error: "That's not one of the cards on offer." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }

  // Has to be a claimed (non-anonymous) account -- the whole point of
  // this reward is securing the account, not something an anonymous
  // session can collect ahead of time.
  if ((userData.user as { is_anonymous?: boolean }).is_anonymous) {
    return NextResponse.json({ error: "Claim your account first." }, { status: 403 });
  }

  const profileId = userData.user.id;

  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("claim_card_choice")
    .eq("id", profileId)
    .single();

  if (existingError) {
    console.error("Claim-choice lookup failed:", existingError.message);
    return NextResponse.json({ error: "Couldn't save your choice right now." }, { status: 503 });
  }

  // Idempotent: a choice already on file wins, even if this gets called
  // twice (a double-click, a retried request) -- nobody re-rolls their
  // pick by resubmitting.
  const already = (existing as { claim_card_choice?: string | null } | null)?.claim_card_choice ?? null;
  if (already) {
    return NextResponse.json({ chosen: already });
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ claim_card_choice: cardId })
    .eq("id", profileId)
    .is("claim_card_choice", null);

  if (updateError) {
    console.error("Claim-choice write failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't save your choice right now." }, { status: 503 });
  }

  return NextResponse.json({ chosen: cardId });
}
