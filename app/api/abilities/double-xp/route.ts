import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Double XP Hour -- see lib/evolution.ts's "ability-double-xp" and
// IDEAS.md's "Big Sep 1 batch." Only ever sets profiles.double_xp_until/
// last_double_xp_at (both locked away from "authenticated" in
// supabase/schema.sql, same as Post Boost's last_boost_at). The actual
// payoff -- doubled Heartbeats -- lives in
// app/api/commons/award-reply/route.ts, which checks double_xp_until
// itself; this route only ever starts the hour, re-deriving the unlock
// and the once-a-week cooldown itself rather than trusting the client.

const DOUBLE_XP_DURATION_MS = 60 * 60 * 1000;
const DOUBLE_XP_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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

  const { data: unlockRow } = await admin
    .from("profile_unlocks")
    .select("unlock_id")
    .eq("profile_id", profileId)
    .eq("unlock_id", "ability-double-xp")
    .maybeSingle();

  if (!unlockRow) {
    return NextResponse.json({ error: "Double XP Hour isn't unlocked yet." }, { status: 403 });
  }

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("last_double_xp_at, double_xp_until")
    .eq("id", profileId)
    .single();

  if (profileError || !profileRow) {
    return NextResponse.json({ error: "Couldn't check your cooldown right now." }, { status: 503 });
  }

  const now = Date.now();

  if (profileRow.double_xp_until && new Date(profileRow.double_xp_until).getTime() > now) {
    return NextResponse.json({ error: "Your Double XP Hour is already running." }, { status: 429 });
  }

  if (profileRow.last_double_xp_at) {
    const readyAt = new Date(profileRow.last_double_xp_at).getTime() + DOUBLE_XP_COOLDOWN_MS;
    if (now < readyAt) {
      const days = Math.ceil((readyAt - now) / (24 * 60 * 60 * 1000));
      return NextResponse.json({ error: `You can activate this again in ${days} ${days === 1 ? "day" : "days"}.` }, { status: 429 });
    }
  }

  const doubleXpUntil = new Date(now + DOUBLE_XP_DURATION_MS).toISOString();

  const { error: updateError } = await admin
    .from("profiles")
    .update({ double_xp_until: doubleXpUntil, last_double_xp_at: new Date(now).toISOString() })
    .eq("id", profileId);

  if (updateError) {
    console.error("Double XP Hour activation failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't activate that right now." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, doubleXpUntil });
}
