// Same Heart -- the Evolution engine.
//
// This is the generic version of the pattern Keys already proved out
// (see lib/keys.ts): a permanent, additive reward, earned from real
// activity the server already trusts, checked idempotently, never spent
// or revoked. Keys stayed hand-written per color because there were only
// four and each needed a genuinely different query. This file exists for
// everything *after* that -- rewards that can be described declaratively
// as "these signals crossed this threshold," so that adding the next one
// is data, not a new code path.
//
// The loop that grants these lives in app/api/evolution/evaluate/route.ts
// and is the only writer of profile_unlocks (see the column-level lockdown
// there and in supabase/schema.sql -- same trust model as profile_keys).
// This file is safe to import from both server and client code: the
// registry and isEligible() are pure data/functions, nothing here ever
// talks to Supabase directly except the two client-facing helpers at the
// bottom, which only ever *read* (or ask the server to (re)check), never
// write.
//
// HOW TO ADD A NEW UNLOCKABLE, once you have a real one to add:
//   1. Add one entry to UNLOCKABLES below with a stable `id` (never
//      change an id after it ships -- it's what's stored per-profile)
//      and an isEligible() written against UnlockableSignals.
//   2. If it needs a signal that isn't in UnlockableSignals yet, add it
//      there and thread it through computeSignals() in the evaluate
//      route -- everything in that type is meant to already be trustworthy
//      data the server can compute from tables it owns.
//   3. If it's a "widget-skin" kind, add the matching skin to
//      lib/widgetSkins.ts with a `unlockId` matching this entry's `id`.
//      Nothing that renders the skin picker needs to change -- it already
//      hides any skin whose unlockId isn't held yet.
// That's the whole extension surface. No new table, no new route, no new
// UI wiring for another widget-skin-kind reward.

import { supabase } from "@/lib/supabaseClient";

export type UnlockKind = "widget-skin"; // more kinds join this union as they ship

// Every signal here is a plain, already-trustworthy derived number --
// never a raw client claim. See computeSignals() in the evaluate route
// for exactly which tables/columns back each one.
export interface UnlockableSignals {
  tenureDays: number; // days since profiles.created_at (or joined_at, whichever the route resolves)
  totalXP: number; // profiles.xp
  longestStreak: number; // profiles.longest_streak -- the permanent record, not the live one
  currentStreak: number; // profiles.current_streak -- for anything that wants "still going," not just "once did"
  keysHeld: number; // count of profile_keys rows
}

export interface Unlockable {
  id: string;
  kind: UnlockKind;
  name: string;
  // Shown only as a locked hint where a UI chooses to show one -- most
  // places on this site follow Keys' lead and stay silent until
  // something's actually earned, so treat this as documentation more
  // than copy that ships everywhere.
  description: string;
  isEligible: (signals: UnlockableSignals) => boolean;
}

export const UNLOCKABLES: Unlockable[] = [
  {
    id: "widget-skin-aurora",
    kind: "widget-skin",
    name: "Aurora",
    description: "Hold at least 2 Keys and keep your capsule for 30 days.",
    isEligible: (s) => s.keysHeld >= 2 && s.tenureDays >= 30,
  },
];

export function findUnlockable(id: string): Unlockable | undefined {
  return UNLOCKABLES.find((u) => u.id === id);
}

// -- Client-facing helpers, same shape as lib/keys.ts's listMyKeys/evaluateKeys. --

export async function listMyUnlocks(): Promise<string[]> {
  const { data, error } = await supabase.from("profile_unlocks").select("unlock_id");
  if (error || !data) return [];
  return data.map((row) => row.unlock_id as string);
}

// Asks the server to (re)check every unlockable against this profile's
// current signals. Safe to call often -- idempotent, and a fast no-op
// once everything eligible right now is already held. Callers shouldn't
// block on this; it's a quiet background check, same as evaluateKeys().
export async function evaluateEvolution(): Promise<{ newlyEarned: string[] }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { newlyEarned: [] };

  try {
    const res = await fetch("/api/evolution/evaluate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { newlyEarned: [] };
    const json = await res.json().catch(() => ({}));
    return { newlyEarned: Array.isArray(json.newlyEarned) ? json.newlyEarned : [] };
  } catch {
    return { newlyEarned: [] };
  }
}
