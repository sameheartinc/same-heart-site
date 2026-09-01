// Same Heart -- the Monetization gate.
//
// Two stages, matching Rob's own design (see IDEAS.md's "Monetization:
// two-stage gate" entry):
//   1. Eligibility -- a pure signal, same trust model as every other
//      progression system on the site: holding all four Heart Strings
//      (see lib/evolution.ts's "monetization-eligible" milestone).
//      Checked via lib/evolution.ts's listMyUnlocks(), not duplicated
//      here.
//   2. Application and approval -- this file's actual job. Eligibility
//      only ever unlocks the *ability to apply*; applying only ever
//      creates a pending row. Nothing is approved except by Rob,
//      personally, in /admin/monetization. No payment functionality
//      exists yet -- this is purely the gate, ready for whenever the
//      legal and banking side is actually in place.

import { supabase } from "@/lib/supabaseClient";

export type MonetizationStatus = "none" | "pending" | "approved" | "denied";

// "none" covers both "never applied" and "not signed in" -- callers
// don't need to tell those apart, since both render the same way (no
// application to show).
export async function getMyMonetizationStatus(): Promise<MonetizationStatus> {
  const { data: userData } = await supabase.auth.getUser();
  const profileId = userData.user?.id;
  if (!profileId) return "none";

  const { data, error } = await supabase
    .from("monetization_applications")
    .select("status")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error || !data) return "none";
  return (data.status as MonetizationStatus) ?? "none";
}

// Asks the server to submit (or resubmit, if previously denied) an
// application. The server re-checks eligibility itself from
// profile_unlocks before writing anything -- this never trusts that the
// caller is actually eligible, same as every other write on this site.
export async function applyForMonetization(): Promise<{ ok: boolean; status?: MonetizationStatus; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "Sign in first." };

  try {
    const res = await fetch("/api/monetization/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || "Couldn't submit your application right now." };
    return { ok: true, status: json.status as MonetizationStatus };
  } catch {
    return { ok: false, error: "Couldn't reach the server." };
  }
}
