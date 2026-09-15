import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeCheckIn } from "@/lib/streak";
import { getStanding } from "@/lib/standing";

// The referral bonus -- Rob, Sep 15 2026: "put the idea about giving
// people heartbeats bonus for users who join and stay." "Stay" was
// scoped deliberately narrow: a verified email plus one real first
// check-in, not just a click on a signup form. This route is the one
// place that can honestly know a first real check-in just happened, so
// it's also the one place the referral reward ever fires.
const REFERRAL_BONUS_XP = 25;

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
    .select("xp, current_streak, longest_streak, last_visit_date, referred_by, referral_reward_claimed_at, email_verified_at")
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

  // Referral completion -- only on someone's genuine first-ever
  // check-in (last_visit_date was null going into this request), only
  // once (the conditional update below only succeeds if
  // referral_reward_claimed_at is still null, which is what makes this
  // safe against a retried or duplicate request double-awarding the
  // referrer), and only if their email is actually verified -- an
  // unverified throwaway account never completes a referral.
  const isFirstEverCheckIn = profileRow.last_visit_date === null;
  if (
    isFirstEverCheckIn &&
    profileRow.referred_by &&
    !profileRow.referral_reward_claimed_at &&
    profileRow.email_verified_at
  ) {
    const { data: claimedRows, error: claimError } = await admin
      .from("profiles")
      .update({ referral_reward_claimed_at: new Date().toISOString() })
      .eq("id", profileId)
      .is("referral_reward_claimed_at", null)
      .select("id");

    if (claimError) {
      console.error("Referral claim-lock failed:", claimError.message);
    } else if (claimedRows && claimedRows.length > 0) {
      const referrerId = profileRow.referred_by as string;
      const { data: referrerRow, error: referrerError } = await admin
        .from("profiles")
        .select("xp, referrals_completed")
        .eq("id", referrerId)
        .single();

      if (referrerError || !referrerRow) {
        console.error("Referral referrer lookup failed:", referrerError?.message);
      } else {
        const referrerNewXp = (referrerRow.xp ?? 0) + REFERRAL_BONUS_XP;
        const referrerNewStanding = getStanding(referrerNewXp);
        const referrerNewReferrals = (referrerRow.referrals_completed ?? 0) + 1;

        const { error: referrerUpdateError } = await admin
          .from("profiles")
          .update({
            xp: referrerNewXp,
            standing: referrerNewStanding,
            referrals_completed: referrerNewReferrals,
          })
          .eq("id", referrerId);

        if (referrerUpdateError) {
          console.error("Referral referrer update failed:", referrerUpdateError.message);
        } else {
          await admin.from("log_entries").insert({
            profile_id: referrerId,
            description: "A friend you invited joined and stayed -- Heart String progress and Heartbeats earned.",
            category: "personal",
            xp_awarded: REFERRAL_BONUS_XP,
          });

          await admin.from("notifications").insert({
            profile_id: referrerId,
            actor_id: profileId,
            kind: "referral",
            body: `Someone you invited just joined and stayed. +${REFERRAL_BONUS_XP} Heartbeats.`,
          });
        }
      }
    }
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
