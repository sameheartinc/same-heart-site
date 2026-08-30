import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStanding } from "@/lib/standing";

// Heartbeats for replying in the Commons -- moved server-side for the
// same reason as app/api/streak/check-in/route.ts: this used to read
// today's total and write xp/standing straight from the client, which
// meant a technically curious user could hand themselves XP with one
// devtools call, no cap enforcement possible client-side to actually
// trust. This route re-derives today's total itself and is now the only
// place that can award it -- see the column-level revoke in
// supabase/schema.sql. Best-effort by design (see lib/commons.ts's
// createReply): a failure here should never block the reply itself,
// which is why the caller wraps this in a try/catch and ignores errors.

const REPLY_HEARTBEATS = 3;
const DAILY_REPLY_HEARTBEATS_CAP = 15;

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
    console.error("Reply heartbeats: today's total lookup failed:", todaysLogError.message);
    return NextResponse.json({ awarded: 0 }, { status: 503 });
  }

  const todaysTotal = (todaysLog ?? []).reduce((sum, r) => sum + (r.xp_awarded ?? 0), 0);
  const award = Math.min(REPLY_HEARTBEATS, Math.max(0, DAILY_REPLY_HEARTBEATS_CAP - todaysTotal));
  if (award <= 0) {
    return NextResponse.json({ awarded: 0 });
  }

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("xp")
    .eq("id", profileId)
    .single();

  if (profileError || !profileRow) {
    console.error("Reply heartbeats: profile read failed:", profileError?.message);
    return NextResponse.json({ awarded: 0 }, { status: 503 });
  }

  const newXp = (profileRow.xp ?? 0) + award;
  const { error: updateError } = await admin
    .from("profiles")
    .update({ xp: newXp, standing: getStanding(newXp) })
    .eq("id", profileId);

  if (updateError) {
    console.error("Reply heartbeats: profile update failed:", updateError.message);
    return NextResponse.json({ awarded: 0 }, { status: 503 });
  }

  await admin.from("log_entries").insert({
    profile_id: profileId,
    description: "Replied in the Commons.",
    category: "commons",
    xp_awarded: award,
  });

  return NextResponse.json({ awarded: award });
}
