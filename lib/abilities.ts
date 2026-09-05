// Same Heart -- client-facing helpers for the two Level-gated abilities
// from the "Big Sep 1 batch" in IDEAS.md: Post Boost and Double XP Hour
// (see lib/evolution.ts's "ability-post-boost"/"ability-double-xp" for
// the unlock itself). Same shape as lib/practices.ts's
// investRipplePoint -- every real check (holding the unlock, the
// once-a-week cooldown, ownership of the thread being boosted) happens
// server-side in app/api/abilities/{boost,double-xp}/route.ts, which
// re-derives all of it itself. These two functions are just the fetch
// wrapper.

import { supabase } from "@/lib/supabaseClient";

async function authedPost(path: string, body?: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "Sign in first." };

  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error ?? "Couldn't do that right now." };
    return { ok: true, ...json };
  } catch {
    return { ok: false, error: "Couldn't reach the server -- try again in a moment." };
  }
}

export async function activateBoost(threadId: string): Promise<{ ok: boolean; error?: string; boostedUntil?: string }> {
  const result = await authedPost("/api/abilities/boost", { threadId });
  return { ok: result.ok, error: result.error, boostedUntil: result.boostedUntil as string | undefined };
}

export async function activateDoubleXp(): Promise<{ ok: boolean; error?: string; doubleXpUntil?: string }> {
  const result = await authedPost("/api/abilities/double-xp");
  return { ok: result.ok, error: result.error, doubleXpUntil: result.doubleXpUntil as string | undefined };
}
