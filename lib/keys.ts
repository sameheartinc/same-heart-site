// Same Heart -- Keys (the first piece of the Keys and Doors design, see
// PLAN.md). A key is a small, permanent achievement earned from real
// activity that already happens elsewhere on the site -- never spent,
// never lost. Granting one only ever happens server-side in
// app/api/keys/evaluate/route.ts, which recomputes eligibility itself
// from data it already trusts -- never from anything the client claims.
// This file just reads what's already been earned and asks the server to
// check for anything new; it never writes a key directly.

import { supabase } from "@/lib/supabaseClient";

export type KeyColor = "green" | "blue" | "red" | "yellow"; // more colors join this union as they ship

export interface ProfileKey {
  key_color: KeyColor;
  earned_at: string;
}

export const KEY_INFO: Record<KeyColor, { name: string; accent: string; blurb: string }> = {
  green: {
    name: "Green Key",
    accent: "#3fae62",
    blurb: "Earned through real, sustained impact on the Exchange.",
  },
  blue: {
    name: "Blue Key",
    accent: "#4a8fe0",
    blurb: "Earned by showing up across several different communities, not just one.",
  },
  red: {
    name: "Red Key",
    accent: "#d9503f",
    blurb: "Earned by actually showing up -- two real weeks of return visits.",
  },
  yellow: {
    name: "Yellow Key",
    accent: "#d9b23f",
    blurb: "Earned by actually reading the Signal -- noticing real news, not just scrolling past it.",
  },
};

// Blue's door: a personal accent color for the Commons, chosen from a
// small curated set rather than a free-text color field -- same reasoning
// as the Skins palette (see lib/skins.ts). Kept out of KEY_INFO since it's
// a reward attached to the key, not a description of the key itself.
export const COMMONS_ACCENT_PALETTE: { label: string; value: string }[] = [
  { label: "Sky", value: "#4a8fe0" },
  { label: "Rose", value: "#e0567b" },
  { label: "Amber", value: "#d9a441" },
  { label: "Violet", value: "#9b6fe0" },
  { label: "Coral", value: "#e0693f" },
  { label: "Teal", value: "#3fb8ae" },
];

export async function listMyKeys(): Promise<ProfileKey[]> {
  const { data, error } = await supabase.from("profile_keys").select("key_color, earned_at");
  if (error || !data) return [];
  return data as ProfileKey[];
}

// Asks the server to check whether any new key has been earned. Safe to
// call often -- idempotent, and a fast no-op once a key's already held.
// Callers shouldn't block on this; it's a quiet background check, not a
// required part of any page load.
export async function evaluateKeys(): Promise<{ newlyEarned: KeyColor[] }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { newlyEarned: [] };

  try {
    const res = await fetch("/api/keys/evaluate", {
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

// Sets the Commons accent color -- only succeeds if the server finds the
// Blue key already held (see app/api/keys/set-accent/route.ts). Returns
// false on any failure so the caller can revert its optimistic UI.
export async function setCommonsAccent(color: string): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return false;

  try {
    const res = await fetch("/api/keys/set-accent", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Red's door -- see app/api/presence/who-is-here/route.ts, which is the
// one place this list is ever actually computed. Returns null on any
// failure (not signed in, not held, server error) so the page can show a
// locked state rather than an empty list that looks broken.
export interface PresentProfile {
  id: string;
  display_name: string | null;
  spark_id: number | null;
  designation: string | null;
}

export async function fetchWhoIsHere(): Promise<PresentProfile[] | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return null;

  try {
    const res = await fetch("/api/presence/who-is-here", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return Array.isArray(json.present) ? json.present : null;
  } catch {
    return null;
  }
}
