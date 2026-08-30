// Same Heart -- Keys (the first piece of the Keys and Doors design, see
// PLAN.md). A key is a small, permanent achievement earned from real
// activity that already happens elsewhere on the site -- never spent,
// never lost. Granting one only ever happens server-side in
// app/api/keys/evaluate/route.ts, which recomputes eligibility itself
// from data it already trusts -- never from anything the client claims.
// This file just reads what's already been earned and asks the server to
// check for anything new; it never writes a key directly.

import { supabase } from "@/lib/supabaseClient";

export type KeyColor = "green"; // more colors join this union as they ship

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
};

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
