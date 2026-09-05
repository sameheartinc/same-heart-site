import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Post Boost -- see lib/evolution.ts's "ability-post-boost" and
// IDEAS.md's "Big Sep 1 batch." The only place commons_threads.
// boosted_until is ever written (that column needs no column-level
// revoke -- commons_threads already has no general UPDATE policy for
// "authenticated" at all, see supabase/schema.sql). Re-derives every
// check itself rather than trusting the client: holding the unlock,
// owning the thread, and the once-a-week cooldown (profiles.
// last_boost_at, locked away from "authenticated" the same way xp is).

const BOOST_DURATION_MS = 24 * 60 * 60 * 1000;
const BOOST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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

  const body = await request.json().catch(() => ({}));
  const threadId = typeof body.threadId === "string" ? body.threadId : null;
  if (!threadId) {
    return NextResponse.json({ error: "Missing threadId." }, { status: 400 });
  }

  const { data: unlockRow } = await admin
    .from("profile_unlocks")
    .select("unlock_id")
    .eq("profile_id", profileId)
    .eq("unlock_id", "ability-post-boost")
    .maybeSingle();

  if (!unlockRow) {
    return NextResponse.json({ error: "Post Boost isn't unlocked yet." }, { status: 403 });
  }

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("last_boost_at")
    .eq("id", profileId)
    .single();

  if (profileError || !profileRow) {
    return NextResponse.json({ error: "Couldn't check your cooldown right now." }, { status: 503 });
  }

  const now = Date.now();
  if (profileRow.last_boost_at) {
    const readyAt = new Date(profileRow.last_boost_at).getTime() + BOOST_COOLDOWN_MS;
    if (now < readyAt) {
      const days = Math.ceil((readyAt - now) / (24 * 60 * 60 * 1000));
      return NextResponse.json({ error: `You can boost again in ${days} ${days === 1 ? "day" : "days"}.` }, { status: 429 });
    }
  }

  const { data: threadRow, error: threadError } = await admin
    .from("commons_threads")
    .select("profile_id")
    .eq("id", threadId)
    .single();

  if (threadError || !threadRow) {
    return NextResponse.json({ error: "Couldn't find that thread." }, { status: 404 });
  }

  if (threadRow.profile_id !== profileId) {
    return NextResponse.json({ error: "You can only boost your own threads." }, { status: 403 });
  }

  const boostedUntil = new Date(now + BOOST_DURATION_MS).toISOString();

  const { error: threadUpdateError } = await admin
    .from("commons_threads")
    .update({ boosted_until: boostedUntil })
    .eq("id", threadId);

  if (threadUpdateError) {
    console.error("Post Boost thread update failed:", threadUpdateError.message);
    return NextResponse.json({ error: "Couldn't boost that right now." }, { status: 503 });
  }

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({ last_boost_at: new Date(now).toISOString() })
    .eq("id", profileId);

  if (profileUpdateError) {
    console.error("Post Boost cooldown update failed:", profileUpdateError.message);
  }

  return NextResponse.json({ ok: true, boostedUntil });
}
