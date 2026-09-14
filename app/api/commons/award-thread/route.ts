import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStanding } from "@/lib/standing";

// Heartbeats for starting a discussion or question in the Commons --
// the one real gap PLAN.md's "character-building expansion" pointed at:
// replying already awarded Heartbeats (see award-reply/route.ts), but
// starting a thread never did, even though seeding a conversation is at
// least as real a contribution as answering one. Same trust model as
// award-reply: this is the only place that ever awards it, re-deriving
// today's total itself rather than trusting the client, and best-effort
// by design (see lib/commons.ts's createThread) -- a failure here should
// never block the thread itself from posting.
//
// Deliberately shares award-reply's "commons" category and daily cap
// rather than getting a separate budget: both are Commons participation,
// and today's total lookup below already sums every "commons" row
// regardless of which route wrote it, so replying and starting threads
// draw from one combined daily allowance without either route needing
// to know about the other.

const THREAD_HEARTBEATS = 5;
const DAILY_COMMONS_HEARTBEATS_CAP = 15;

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

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data: todaysLog, error: todaysLogError } = await admin
    .from("log_entries")
    .select("xp_awarded")
    .eq("profile_id", profileId)
    .eq("category", "commons")
    .gte("occurred_at", startOfDay.toISOString());

  if (todaysLogError) {
    console.error("Thread heartbeats: today's total lookup failed:", todaysLogError.message);
    return NextResponse.json({ awarded: 0 }, { status: 503 });
  }

  const todaysTotal = (todaysLog ?? []).reduce((sum, r) => sum + (r.xp_awarded ?? 0), 0);
  const baseAward = Math.min(THREAD_HEARTBEATS, Math.max(0, DAILY_COMMONS_HEARTBEATS_CAP - todaysTotal));
  if (baseAward <= 0) {
    return NextResponse.json({ awarded: 0 });
  }

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("xp, double_xp_until")
    .eq("id", profileId)
    .single();

  if (profileError || !profileRow) {
    console.error("Thread heartbeats: profile read failed:", profileError?.message);
    return NextResponse.json({ awarded: 0 }, { status: 503 });
  }

  const doubleXpActive = Boolean(profileRow.double_xp_until && new Date(profileRow.double_xp_until).getTime() > Date.now());
  const award = doubleXpActive ? baseAward * 2 : baseAward;

  const newXp = (profileRow.xp ?? 0) + award;
  const { error: updateError } = await admin
    .from("profiles")
    .update({ xp: newXp, standing: getStanding(newXp) })
    .eq("id", profileId);

  if (updateError) {
    console.error("Thread heartbeats: profile update failed:", updateError.message);
    return NextResponse.json({ awarded: 0 }, { status: 503 });
  }

  await admin.from("log_entries").insert({
    profile_id: profileId,
    description: "Started a discussion in the Commons.",
    category: "commons",
    xp_awarded: award,
  });

  return NextResponse.json({ awarded: award });
}
