import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { UNLOCKABLES, findUnlockable, type UnlockableSignals } from "@/lib/evolution";

// Evolution, part 1 -- the generic sibling of app/api/keys/evaluate/route.ts.
// Same trust model: this is the only place a row is ever written to
// profile_unlocks, and it re-derives every signal itself from tables it
// already owns rather than believing anything the client claims. Safe to
// call repeatedly -- an unlock already held is a fast no-op, and nothing
// granted here is ever revoked.
//
// Adding a new unlockable never touches this file (see lib/evolution.ts
// for the extension notes) unless it needs a signal that doesn't exist
// in UnlockableSignals yet -- in which case add it to both places.

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

  const { data: existingUnlocks, error: existingError } = await admin
    .from("profile_unlocks")
    .select("unlock_id")
    .eq("profile_id", profileId);

  if (existingError) {
    console.error("Unlock lookup failed:", existingError.message);
    return NextResponse.json({ error: "Couldn't check your unlocks right now." }, { status: 503 });
  }

  const alreadyHeld = new Set((existingUnlocks ?? []).map((u) => u.unlock_id));
  const stillToCheck = UNLOCKABLES.filter((u) => !alreadyHeld.has(u.id));

  // Nothing left to check -- skip the signal queries entirely.
  if (stillToCheck.length === 0) {
    return NextResponse.json({ newlyEarned: [] });
  }

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("joined_at, xp, longest_streak, current_streak")
    .eq("id", profileId)
    .single();

  if (profileError || !profileRow) {
    console.error("Evolution signal lookup failed:", profileError?.message ?? "no profile row");
    return NextResponse.json({ error: "Couldn't check your unlocks right now." }, { status: 503 });
  }

  const { count: keysCount, error: keysError } = await admin
    .from("profile_keys")
    .select("key_color", { count: "exact", head: true })
    .eq("profile_id", profileId);

  if (keysError) {
    console.error("Evolution signal lookup failed:", keysError.message);
    return NextResponse.json({ error: "Couldn't check your unlocks right now." }, { status: 503 });
  }

  const joinedAt = profileRow.joined_at ? new Date(profileRow.joined_at as string) : new Date();
  const tenureDays = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));

  const signals: UnlockableSignals = {
    tenureDays,
    totalXP: profileRow.xp ?? 0,
    longestStreak: profileRow.longest_streak ?? 0,
    currentStreak: profileRow.current_streak ?? 0,
    keysHeld: keysCount ?? 0,
  };

  const newlyEarned: string[] = [];

  for (const unlockable of stillToCheck) {
    if (!unlockable.isEligible(signals)) continue;

    const { error: insertError } = await admin
      .from("profile_unlocks")
      .insert({ profile_id: profileId, unlock_id: unlockable.id });

    if (insertError) {
      // Unique-constraint clash just means another request already
      // granted it a moment earlier -- not a real failure.
      if (insertError.code !== "23505") {
        console.error(`Unlock insert failed for ${unlockable.id}:`, insertError.message);
      }
      continue;
    }

    newlyEarned.push(unlockable.id);
    const info = findUnlockable(unlockable.id);
    await admin.from("log_entries").insert({
      profile_id: profileId,
      description: `Unlocked ${info?.name ?? unlockable.id}.`,
      category: "personal",
      xp_awarded: 0,
    });
  }

  return NextResponse.json({ newlyEarned });
}
