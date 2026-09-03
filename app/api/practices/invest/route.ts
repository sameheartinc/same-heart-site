import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getLevel } from "@/lib/primeLevels";
import {
  PRACTICE_ORDER,
  normalizePracticePoints,
  unspentRipplePoints,
  type PracticeKey,
} from "@/lib/practices";

// The only writer of profiles.practice_points -- see the column-level
// revoke in supabase/schema.sql, same trust model as commons_accent's
// set-accent route. Recomputes the real math itself (Level from XP,
// unspent Ripple Points from Level minus what's already invested) rather
// than trusting anything the client sends, since a client-writable point
// balance would let anyone hand themselves infinite Practice tiers.

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const practice = typeof body?.practice === "string" ? (body.practice as PracticeKey) : null;
  if (!practice || !PRACTICE_ORDER.includes(practice)) {
    return NextResponse.json({ error: "Not a real Practice." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }
  const profileId = userData.user.id;

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("xp, practice_points")
    .eq("id", profileId)
    .single();

  if (profileError || !profileRow) {
    console.error("Ripple Point invest -- profile fetch failed:", profileError?.message);
    return NextResponse.json({ error: "Couldn't verify your Level right now." }, { status: 503 });
  }

  const level = getLevel(profileRow.xp ?? 0);
  const currentPoints = normalizePracticePoints(profileRow.practice_points);
  const unspent = unspentRipplePoints(level, currentPoints);

  if (unspent <= 0) {
    return NextResponse.json({ error: "No unspent Ripple Points right now -- keep leveling up." }, { status: 403 });
  }

  const nextPoints = { ...currentPoints, [practice]: currentPoints[practice] + 1 };

  const { error: updateError } = await admin
    .from("profiles")
    .update({ practice_points: nextPoints })
    .eq("id", profileId);

  if (updateError) {
    console.error("Ripple Point invest -- update failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't save that just now." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, points: nextPoints });
}
