import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeCheckIn } from "@/lib/streak";
import { getStanding } from "@/lib/standing";

// The return-engagement check-in, moved fully server-side. This used to
// run client-side (compute the new streak, then write xp/standing/streak
// straight from the browser) -- which meant a technically curious user
// could set their own xp, standing, or streak to anything at all with one
// devtools call, no different in kind from the current_streak gap noted
// in PLAN.md. This route re-derives everything itself from the profile
// row it reads, using the same pure logic (lib/streak.ts, unchanged), and
// is now the only place these columns are ever written -- see the
// column-level revoke in supabase/schema.sql. Idempotent: a second call
// the same day is a fast no-op, same as before.

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
    .select("xp, current_streak, longest_streak, last_visit_date")
    .eq("id", profileId)
    .single();

  if (profileError || !profileRow) {
    console.error("Check-in profile read failed:", profileError?.message);
    return NextResponse.json({ error: "Couldn't check in right now." }, { status: 503 });
  }

  const checkIn = computeCheckIn({
    current_streak: profileRow.current_streak ?? 0,
    longest_streak: profileRow.longest_streak ?? 0,
    last_visit_date: profileRow.last_visit_date ?? null,
  });

  if (!checkIn.changed) {
    return NextResponse.json({
      changed: false,
      xp: profileRow.xp,
      standing: getStanding(profileRow.xp ?? 0),
      streak: checkIn.streak,
      milestone: null,
    });
  }

  const newXp = (profileRow.xp ?? 0) + checkIn.xpAwarded;
  const newStanding = getStanding(newXp);
  const description = checkIn.milestone
    ? `Checked in -- day ${checkIn.streak.current_streak} streak. ${checkIn.milestone.label}.`
    : `Checked in -- day ${checkIn.streak.current_streak} streak.`;

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      xp: newXp,
      standing: newStanding,
      current_streak: checkIn.streak.current_streak,
      longest_streak: checkIn.streak.longest_streak,
      last_visit_date: checkIn.streak.last_visit_date,
    })
    .eq("id", profileId);

  if (updateError) {
    console.error("Check-in update failed:", updateError.message);
    return NextResponse.json({ error: "Couldn't save your check-in right now." }, { status: 503 });
  }

  const { data: logEntry, error: logInsertError } = await admin
    .from("log_entries")
    .insert({
      profile_id: profileId,
      description,
      category: "system",
      xp_awarded: checkIn.xpAwarded,
    })
    .select("id, occurred_at, description, xp_awarded")
    .single();

  if (logInsertError) {
    console.error("Check-in log_entries insert failed:", logInsertError.message);
  }

  return NextResponse.json({
    changed: true,
    xp: newXp,
    standing: newStanding,
    streak: checkIn.streak,
    milestone: checkIn.milestone,
    logEntry: logInsertError ? null : logEntry,
  });
}
