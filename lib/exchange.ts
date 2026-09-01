// Same Heart -- The Exchange (client-side helpers).
//
// The actual scoring and Heartbeats award only ever happen server-side
// in app/api/exchange/transmit/route.ts (it needs the Anthropic API key,
// which must never reach the browser, and the reward has to be computed
// somewhere a user can't just fake it). This file is what the Commons UI
// uses to submit a link to that route and to read back what's already
// been transmitted / how the Roster is ranked.

import { supabase } from "@/lib/supabaseClient";

export interface Transmission {
  id: string;
  profile_id: string;
  url: string;
  title: string | null;
  domain: string | null;
  issue_key: string | null;
  impact_score: number | null;
  reasoning: string | null;
  heartbeats_awarded: number;
  tagline: string | null;
  image_url: string | null;
  created_at: string;
}

export interface RankedProfile {
  id: string;
  display_name: string | null;
  spark_id: number | null;
  designation: string | null;
  ship_skin: string | null;
  xp: number;
  standing: string;
  current_streak: number;
  longest_streak: number;
}

export interface TransmitResult {
  transmission: Transmission;
  heartbeatsAwarded: number;
  newXp: number;
  newStanding: string;
  dailyCapReached: boolean;
}

export async function listRecentTransmissions(limit = 20): Promise<Transmission[]> {
  const { data, error } = await supabase
    .from("exchange_transmissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Transmission[];
}

// One profile's own transmissions, oldest-excluded-first (most recent
// first) -- the Green Key's door (see PLAN.md and lib/keys.ts): a
// personal "impact history" page compiling everything someone's ever
// transmitted and what it actually scored. Reads the same public table
// listRecentTransmissions does, just filtered to the signed-in profile,
// so it needs no new RLS -- exchange_transmissions is already readable
// by anyone (the Commons feed depends on that), this just narrows it.
export async function listMyTransmissions(): Promise<Transmission[]> {
  const { data: userData } = await supabase.auth.getUser();
  const profileId = userData.user?.id;
  if (!profileId) return [];

  const { data, error } = await supabase
    .from("exchange_transmissions")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Transmission[];
}

export async function listRoster(limit = 50): Promise<RankedProfile[]> {
  const { data, error } = await supabase
    .from("public_rankings")
    .select("*")
    .order("xp", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as RankedProfile[];
}

// Posts a link to the scoring route. `tagline` is an optional short,
// bold one-liner the person is adding themselves (their own pitch for the
// link, not part of the AI scoring) -- trimmed here, capped and validated
// again server-side since this is a client helper, not a trust boundary.
// Throws with a human-readable message on failure (bad URL, daily cap,
// network) -- callers should catch and show `error.message` directly,
// it's already written for a person to read.
export async function transmitLink(url: string, tagline?: string, imageUrl?: string): Promise<TransmitResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("You need to be signed in to transmit.");

  const trimmedTagline = tagline?.trim();

  const res = await fetch("/api/exchange/transmit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url, tagline: trimmedTagline || undefined, imageUrl: imageUrl || undefined }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "That transmission didn't go through -- try again in a moment.");
  }
  return json as TransmitResult;
}
