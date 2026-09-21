import { supabase } from "@/lib/supabaseClient";
import type { BoostPart } from "@/lib/xpActions";

// Client side of the XP engine (see lib/xpEngine.ts for the real logic).
// Neither function here decides or trusts anything -- one reports "I did
// this to that row," the other reads back numbers the server derived.

export interface Progression {
  xp: number;
  level: number;
  nextLevelXp: number | null;
  standing: string;
  momentum: number;
  streak: number;
  boost: { total: number; parts: BoostPart[] };
  reputation: number;
}

// Best-effort by design, same posture the old award routes had: whatever
// the answer is, it must never block or fail the thing the person just
// did (posting a reply). Returns the XP granted, or 0.
export async function claimXp(action: string, targetId: string): Promise<number> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return 0;
    const res = await fetch("/api/xp/award", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetId }),
    });
    if (!res.ok) return 0;
    const json = await res.json().catch(() => ({}));
    return typeof json.awarded === "number" ? json.awarded : 0;
  } catch {
    return 0;
  }
}

export async function fetchProgression(): Promise<Progression | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return null;
    const res = await fetch("/api/progression", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return (await res.json()) as Progression;
  } catch {
    return null;
  }
}
