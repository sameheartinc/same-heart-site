import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Keys, part 1 -- see the Keys and Doors design in PLAN.md. This route is
// the only place a key is ever granted: it re-derives eligibility itself
// from data that's already trustworthy (exchange_transmissions is written
// only by app/api/exchange/transmit/route.ts, server-side, from a real
// scored impact -- nothing here trusts a value the client hands it), then
// inserts a permanent row if it's earned. Safe to call repeatedly: a key
// already held is a fast no-op, and nothing granted here is ever revoked.

const GREEN_KEY_MIN_TRANSMISSIONS = 5;
const GREEN_KEY_MIN_AVG_SCORE = 60;
const BLUE_KEY_MIN_COMMUNITIES = 3;

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

  const { data: existingKeys, error: existingError } = await admin
    .from("profile_keys")
    .select("key_color")
    .eq("profile_id", profileId);

  if (existingError) {
    console.error("Key lookup failed:", existingError.message);
    return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
  }

  const alreadyHeld = new Set((existingKeys ?? []).map((k) => k.key_color));
  const newlyEarned: string[] = [];

  // Green: real, sustained impact through the Exchange -- an average
  // score across several transmissions, not a raw count, so it can't be
  // gamed by spamming low-effort links.
  if (!alreadyHeld.has("green")) {
    const { data: transmissions, error: transmissionsError } = await admin
      .from("exchange_transmissions")
      .select("impact_score")
      .eq("profile_id", profileId);

    if (transmissionsError) {
      console.error("Green key eligibility check failed:", transmissionsError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    const scores = (transmissions ?? [])
      .map((t) => t.impact_score)
      .filter((s): s is number => typeof s === "number");
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    if (scores.length >= GREEN_KEY_MIN_TRANSMISSIONS && avgScore >= GREEN_KEY_MIN_AVG_SCORE) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "green" });

      if (insertError) {
        // Unique-constraint clash just means another request already
        // granted it a moment earlier -- not a real failure.
        if (insertError.code !== "23505") {
          console.error("Green key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("green");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Green Key -- real, sustained impact through the Exchange.",
          category: "humanitarian",
          xp_awarded: 0,
        });
      }
    }
  }


  // Blue: breadth in the Commons -- posting or replying across several
  // different communities rather than living in just one. Counted from
  // commons_threads and commons_replies directly (both server-truthful:
  // profile_id is set from the authenticated caller at insert time, and
  // community_id is a real foreign key), never from a client-supplied
  // count.
  if (!alreadyHeld.has("blue")) {
    const { data: ownThreads, error: ownThreadsError } = await admin
      .from("commons_threads")
      .select("community_id")
      .eq("profile_id", profileId);

    if (ownThreadsError) {
      console.error("Blue key eligibility check failed:", ownThreadsError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    const { data: ownReplies, error: ownRepliesError } = await admin
      .from("commons_replies")
      .select("thread_id")
      .eq("profile_id", profileId);

    if (ownRepliesError) {
      console.error("Blue key eligibility check failed:", ownRepliesError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    const communityIds = new Set<string>();
    for (const t of ownThreads ?? []) {
      if (t.community_id) communityIds.add(t.community_id);
    }

    const replyThreadIds = Array.from(
      new Set((ownReplies ?? []).map((r) => r.thread_id).filter((id): id is string => Boolean(id)))
    );

    if (replyThreadIds.length > 0) {
      const { data: repliedThreads, error: repliedThreadsError } = await admin
        .from("commons_threads")
        .select("community_id")
        .in("id", replyThreadIds);

      if (repliedThreadsError) {
        console.error("Blue key eligibility check failed:", repliedThreadsError.message);
        return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
      }
      for (const t of repliedThreads ?? []) {
        if (t.community_id) communityIds.add(t.community_id);
      }
    }

    if (communityIds.size >= BLUE_KEY_MIN_COMMUNITIES) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "blue" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("Blue key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("blue");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Blue Key -- active across several different communities.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }

  return NextResponse.json({ newlyEarned });
}
