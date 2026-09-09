import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStanding } from "@/lib/standing";
import { toUTCDateString } from "@/lib/streak";

// The Same Heart mark's secret tap bonus (Sep 9 2026, Rob's own idea --
// see lib/heartTap.ts and app/galaxy/page.tsx for the client half).
// Deliberately the ONLY place last_heart_tap_bonus_date or the XP it
// gates can ever move (see the column-level revoke in schema.sql) --
// re-checks "already claimed today?" itself from the DB rather than
// trusting anything the client says, same as every other XP source on
// this site (app/api/streak/check-in, app/api/exchange/transmit).
//
// No request body at all -- the client can call this whenever it wants
// (once it's decided a visit crossed its own hidden tap threshold),
// but it never gets to say how much XP, or whether it's allowed today.
// Both of those are entirely this route's call.

const MIN_BONUS_XP = 4;
const MAX_BONUS_XP = 14;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }
  const profileId = userData.user.id;

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("xp, last_heart_tap_bonus_date")
    .eq("id", profileId)
    .single();

  if (profileError || !profileRow) {
    return NextResponse.json({ error: "Couldn't check that right now." }, { status: 503 });
  }

  const today = toUTCDateString(new Date());
  if (profileRow.last_heart_tap_bonus_date === today) {
    // Already claimed today -- a soft, quiet no-op, not an error. The
    // whole point is nothing on screen ever explains why a tap did or
    // didn't pay out.
    return NextResponse.json({ ok: true, awarded: false });
  }

  const amount = MIN_BONUS_XP + Math.floor(Math.random() * (MAX_BONUS_XP - MIN_BONUS_XP + 1));
  const currentXp = profileRow.xp ?? 0;
  const newXp = currentXp + amount;
  const newStanding = getStanding(newXp);

  const { error: updateError } = await admin
    .from("profiles")
    .update({ xp: newXp, standing: newStanding, last_heart_tap_bonus_date: today })
    .eq("id", profileId);

  if (updateError) {
    console.error("Heart-tap bonus update failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't award that right now." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, awarded: true, xp: amount, newXp, newStanding });
}
