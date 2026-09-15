import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { YELLOW_KEY_MIN_ARTICLES, PURPLE_KEY_MIN_VISIT_DAYS, ORANGE_KEY_MIN_REFERRALS } from "@/lib/keys";

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
const RED_KEY_MIN_LONGEST_STREAK = 14;
// YELLOW_KEY_MIN_ARTICLES and PURPLE_KEY_MIN_VISIT_DAYS live in
// lib/keys.ts, shared with the pages that show real progress toward
// them so those numbers can never drift from what this route enforces.
const PINK_KEY_MIN_RECIPROCAL_THREADS = 5;
const MAGENTA_KEY_MIN_MEMBERS = 5;
const MAGENTA_KEY_MIN_NON_FOUNDER_THREADS = 3;
const INDIGO_KEY_MIN_GUIDE_DAYS = 10;
const WHITE_KEY_MIN_TENURE_DAYS = 180;
const WHITE_KEY_MIN_XP = 250; // matches Beacon in lib/standing.ts -- "sustained good standing," not just time served
const BLACK_KEY_MIN_OTHER_KEYS = 5; // out of the 10 other colors (was 9 before Orange, Sep 15 2026)
// ORANGE_KEY_MIN_REFERRALS lives in lib/keys.ts, same reasoning as
// YELLOW/PURPLE's constants above -- shared with the Hub's Invite panel.

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
          description: "Earned the Green Heart String -- real, sustained impact through the Exchange.",
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
          description: "Earned the Blue Heart String -- active across several different communities.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }


  // Red: presence -- a real return streak, at least two full weeks of
  // actually showing up on separate days. Checked against longest_streak,
  // not current_streak, since a key once earned should stay earned even
  // if the streak later breaks -- current_streak is for the Hub's live
  // display, longest_streak is the permanent record. Both columns are
  // now only ever written by app/api/streak/check-in/route.ts (see the
  // column-level revoke in supabase/schema.sql), so this read is trustworthy.
  if (!alreadyHeld.has("red")) {
    const { data: streakProfile, error: streakError } = await admin
      .from("profiles")
      .select("longest_streak")
      .eq("id", profileId)
      .single();

    if (streakError) {
      console.error("Red key eligibility check failed:", streakError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    if ((streakProfile?.longest_streak ?? 0) >= RED_KEY_MIN_LONGEST_STREAK) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "red" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("Red key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("red");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Red Heart String -- two real weeks of showing up.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }


  // Yellow: engagement with the Signal -- noticing and acting on real
  // news, not just scrolling past it. Counted from signal_engagement
  // (see supabase/schema.sql), which only ever records a real click
  // through to a real article, one row per profile+article thanks to
  // its unique constraint -- so this can't be gamed by re-clicking the
  // same link.
  if (!alreadyHeld.has("yellow")) {
    const { count: engagementCount, error: engagementError } = await admin
      .from("signal_engagement")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId);

    if (engagementError) {
      console.error("Yellow key eligibility check failed:", engagementError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    if ((engagementCount ?? 0) >= YELLOW_KEY_MIN_ARTICLES) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "yellow" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("Yellow key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("yellow");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Yellow Heart String -- real engagement with the Signal.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }

  // Purple: self-knowledge -- coming back to your own Star Day reading
  // across several real, separate days, counted from star_day_visits
  // (see supabase/schema.sql), whose unique (profile_id, visit_date)
  // constraint already guarantees one row per day no matter how many
  // times the client calls recordStarDayVisit() in one sitting.
  if (!alreadyHeld.has("purple")) {
    const { data: visits, error: visitsError } = await admin
      .from("star_day_visits")
      .select("visit_date")
      .eq("profile_id", profileId);

    if (visitsError) {
      console.error("Purple key eligibility check failed:", visitsError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    const distinctDays = new Set((visits ?? []).map((v) => v.visit_date)).size;

    if (distinctDays >= PURPLE_KEY_MIN_VISIT_DAYS) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "purple" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("Purple key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("purple");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Purple Heart String -- real self-knowledge, coming back to your own reading.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }


  // Pink: reciprocity -- not how many replies someone writes, but how
  // many of them start a genuine back-and-forth. For each thread this
  // profile replied to (excluding their own threads), reciprocity means
  // that thread's own author posted a reply of their own in the same
  // thread after this profile's first reply landed there. Counted per
  // distinct thread, so one long exchange never counts more than once.
  if (!alreadyHeld.has("pink")) {
    const { data: ownReplies, error: ownRepliesError } = await admin
      .from("commons_replies")
      .select("thread_id, created_at")
      .eq("profile_id", profileId);

    if (ownRepliesError) {
      console.error("Pink key eligibility check failed:", ownRepliesError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    const threadIds = Array.from(
      new Set((ownReplies ?? []).map((r) => r.thread_id).filter((id): id is string => Boolean(id)))
    );

    let reciprocalThreads = 0;

    if (threadIds.length > 0) {
      const { data: threads, error: threadsError } = await admin
        .from("commons_threads")
        .select("id, profile_id")
        .in("id", threadIds);

      if (threadsError) {
        console.error("Pink key eligibility check failed:", threadsError.message);
        return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
      }

      const authorByThread = new Map((threads ?? []).map((t) => [t.id, t.profile_id]));
      const otherThreadIds = threadIds.filter(
        (id) => authorByThread.get(id) && authorByThread.get(id) !== profileId
      );

      if (otherThreadIds.length > 0) {
        const { data: allReplies, error: allRepliesError } = await admin
          .from("commons_replies")
          .select("thread_id, profile_id, created_at")
          .in("thread_id", otherThreadIds);

        if (allRepliesError) {
          console.error("Pink key eligibility check failed:", allRepliesError.message);
          return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
        }

        const earliestOwnByThread = new Map<string, string>();
        for (const r of ownReplies ?? []) {
          if (!r.thread_id || !otherThreadIds.includes(r.thread_id)) continue;
          const existing = earliestOwnByThread.get(r.thread_id);
          if (!existing || r.created_at < existing) earliestOwnByThread.set(r.thread_id, r.created_at);
        }

        const reciprocalSet = new Set<string>();
        for (const reply of allReplies ?? []) {
          const author = authorByThread.get(reply.thread_id);
          if (!author || reply.profile_id !== author) continue;
          const ownTime = earliestOwnByThread.get(reply.thread_id);
          if (ownTime && reply.created_at > ownTime) reciprocalSet.add(reply.thread_id);
        }
        reciprocalThreads = reciprocalSet.size;
      }
    }

    if (reciprocalThreads >= PINK_KEY_MIN_RECIPROCAL_THREADS) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "pink" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("Pink key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("pink");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Pink Heart String -- real, two-way relationships in the Commons.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }


  // Magenta: origination -- founding a community that other people
  // actually keep using, not just starting one and leaving it empty.
  // Requires both a real membership base and real activity from people
  // other than the founder, checked against every community this
  // profile has founded (most people will have zero or one).
  if (!alreadyHeld.has("magenta")) {
    const { data: ownCommunities, error: ownCommunitiesError } = await admin
      .from("communities")
      .select("id")
      .eq("created_by", profileId);

    if (ownCommunitiesError) {
      console.error("Magenta key eligibility check failed:", ownCommunitiesError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    let qualifies = false;
    for (const community of ownCommunities ?? []) {
      const { count: memberCount, error: memberError } = await admin
        .from("community_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("community_id", community.id);

      if (memberError) {
        console.error("Magenta key eligibility check failed:", memberError.message);
        return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
      }

      const { count: activeThreadCount, error: threadError } = await admin
        .from("commons_threads")
        .select("id", { count: "exact", head: true })
        .eq("community_id", community.id)
        .neq("profile_id", profileId);

      if (threadError) {
        console.error("Magenta key eligibility check failed:", threadError.message);
        return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
      }

      if (
        (memberCount ?? 0) >= MAGENTA_KEY_MIN_MEMBERS &&
        (activeThreadCount ?? 0) >= MAGENTA_KEY_MIN_NON_FOUNDER_THREADS
      ) {
        qualifies = true;
        break;
      }
    }

    if (qualifies) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "magenta" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("Magenta key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("magenta");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Magenta Heart String -- founded a community that people actually keep using.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }


  // Indigo: sustained curiosity -- real, repeated use of the Commons
  // Guide across several distinct days. guide_messages deliberately
  // never stores the message text itself (see supabase/schema.sql), so
  // this reads distinct calendar days rather than distinct topics --
  // the honest signal this table can actually support.
  if (!alreadyHeld.has("indigo")) {
    const { data: guideRows, error: guideError } = await admin
      .from("guide_messages")
      .select("created_at")
      .eq("profile_id", profileId);

    if (guideError) {
      console.error("Indigo key eligibility check failed:", guideError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    const distinctDays = new Set(
      (guideRows ?? []).map((r) => new Date(r.created_at as string).toISOString().slice(0, 10))
    ).size;

    if (distinctDays >= INDIGO_KEY_MIN_GUIDE_DAYS) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "indigo" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("Indigo key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("indigo");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Indigo Heart String -- real, sustained curiosity about the site itself.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }


  // White: tenure and legacy -- real account age carried alongside
  // sustained good standing, not just "been here a while." xp is only
  // ever written by app/api/streak/check-in/route.ts and
  // app/api/commons/award-reply/route.ts (see the column-level revoke
  // in supabase/schema.sql), so this read is trustworthy.
  if (!alreadyHeld.has("white")) {
    const { data: profileRow, error: profileError } = await admin
      .from("profiles")
      .select("joined_at, xp")
      .eq("id", profileId)
      .single();

    if (profileError) {
      console.error("White key eligibility check failed:", profileError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    const joinedAt = profileRow?.joined_at ? new Date(profileRow.joined_at as string) : new Date();
    const tenureDays = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

    if (tenureDays >= WHITE_KEY_MIN_TENURE_DAYS && (profileRow?.xp ?? 0) >= WHITE_KEY_MIN_XP) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "white" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("White key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("white");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the White Heart String -- real tenure, carried alongside real standing.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }


  // Orange: real referrals -- a friend who actually joined and stayed,
  // not just clicked a link. referrals_completed is only ever
  // incremented from app/api/streak/check-in/route.ts, the one place
  // that can honestly know someone's first real check-in just
  // happened, so this read is trustworthy the same way Red's
  // longest_streak read is.
  if (!alreadyHeld.has("orange")) {
    const { data: referralProfile, error: referralError } = await admin
      .from("profiles")
      .select("referrals_completed")
      .eq("id", profileId)
      .single();

    if (referralError) {
      console.error("Orange key eligibility check failed:", referralError.message);
      return NextResponse.json({ error: "Couldn't check your keys right now." }, { status: 503 });
    }

    if ((referralProfile?.referrals_completed ?? 0) >= ORANGE_KEY_MIN_REFERRALS) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "orange" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("Orange key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("orange");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Orange Heart String -- real people brought to Same Heart, who actually stayed.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }


  // Black: the meta-key -- only earned by already holding a real number
  // of the other ten at once. Checked last on purpose, and reads
  // alreadyHeld.size + newlyEarned.length rather than re-querying the
  // database, so a key earned earlier in this very call (e.g. someone
  // crossing several thresholds in one visit) counts immediately
  // instead of needing a second evaluateKeys() call to notice.
  if (!alreadyHeld.has("black")) {
    const otherKeysHeld = alreadyHeld.size + newlyEarned.length;

    if (otherKeysHeld >= BLACK_KEY_MIN_OTHER_KEYS) {
      const { error: insertError } = await admin
        .from("profile_keys")
        .insert({ profile_id: profileId, key_color: "black" });

      if (insertError) {
        if (insertError.code !== "23505") {
          console.error("Black key insert failed:", insertError.message);
        }
      } else {
        newlyEarned.push("black");
        await admin.from("log_entries").insert({
          profile_id: profileId,
          description: "Earned the Black Heart String -- the meta-key. Breadth and depth together, at once.",
          category: "personal",
          xp_awarded: 0,
        });
      }
    }
  }

  return NextResponse.json({ newlyEarned });
}
