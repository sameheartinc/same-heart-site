import { supabase } from "@/lib/supabaseClient";
import { PATHS, type PathKey } from "@/lib/paths";
import { getWorldIssue } from "@/lib/worldIssues";
import type { PublicProfile } from "@/lib/commons";

// Kindred Sparks -- a plain overlap-scoring "people you might have
// something in common with" widget. See IDEAS.md's "Kindred Sparks --
// defined" entry for the full reasoning: it only ever looks at signals
// that are already public elsewhere on the site (Path archetype via
// public_profiles.path_key, World Issues raised through the Exchange via
// exchange_transmissions.issue_key), it always shows a plain-language
// reason for every match, and it's computed fresh on every read -- no
// new table, no persisted score, nothing to go stale. Community overlap
// is deliberately left out of this first version (see the docket entry).
// Anyone can opt out via profiles.kindred_opt_out even though nothing it
// reads is private, because pointing two specific people at each other
// is a step beyond either of them just seeing each other's own profile.

export interface KindredMatch {
  profile: PublicProfile;
  score: number;
  reasons: string[];
}

// Rarity weight: a shared trait that almost everyone has barely counts;
// one only a handful of people share counts for a lot more. Floors at
// 0.2 so even the most common overlap still contributes something.
function rarityWeight(sharedByCount: number, totalCount: number) {
  if (totalCount <= 0) return 0.2;
  return Math.max(0.2, 1 - sharedByCount / totalCount);
}

export async function findKindredSparks(myProfileId: string, limit = 3): Promise<KindredMatch[]> {
  // get_public_profiles(), not a "public_profiles" view -- see
  // lib/commons.ts's fetchProfilesByIds for why (Supabase's Security
  // Advisor flags a view that has to bypass profiles' own RLS to show
  // everyone else's row, even one this narrow and intentional; a
  // SECURITY DEFINER function does the same job without the flag).
  // p_ids left null asks for everyone, same as the view's unfiltered
  // select did -- the .eq("kindred_opt_out", false) below still applies
  // to the function's table output exactly like it did to the view's.
  const [profilesResult, transmissionsResult] = await Promise.all([
    supabase.rpc("get_public_profiles", { p_ids: null }).eq("kindred_opt_out", false),
    supabase.from("exchange_transmissions").select("profile_id, issue_key").not("issue_key", "is", null),
  ]);

  const profiles = (profilesResult.data ?? []) as PublicProfile[];
  if (profiles.length === 0) return [];

  const me = profiles.find((p) => p.id === myProfileId);
  // If the current person opted out, or has no public row for some
  // reason, there's nothing to match them against or show them.
  if (!me) return [];

  // Every profile's set of raised World Issues, from the same public
  // Exchange feed the Commons and Impact pages already show.
  const issuesByProfile = new Map<string, Set<string>>();
  for (const row of (transmissionsResult.data ?? []) as Array<{ profile_id: string | null; issue_key: string | null }>) {
    if (!row.profile_id || !row.issue_key) continue;
    if (!issuesByProfile.has(row.profile_id)) issuesByProfile.set(row.profile_id, new Set());
    issuesByProfile.get(row.profile_id)!.add(row.issue_key);
  }
  const myIssues = issuesByProfile.get(myProfileId) ?? new Set<string>();

  // How common is each Path / issue across everyone eligible to match?
  const totalProfiles = profiles.length;
  const pathCounts = new Map<string, number>();
  for (const p of profiles) {
    if (!p.path_key) continue;
    pathCounts.set(p.path_key, (pathCounts.get(p.path_key) ?? 0) + 1);
  }
  const issueCounts = new Map<string, number>();
  for (const set of issuesByProfile.values()) {
    for (const key of set) issueCounts.set(key, (issueCounts.get(key) ?? 0) + 1);
  }

  const matches: KindredMatch[] = [];
  for (const p of profiles) {
    if (p.id === myProfileId) continue;
    let score = 0;
    const reasons: string[] = [];

    if (me.path_key && p.path_key === me.path_key) {
      score += rarityWeight(pathCounts.get(p.path_key) ?? 1, totalProfiles);
      const path = PATHS[me.path_key as PathKey];
      if (path) reasons.push(`You're both ${path.name}s.`);
    }

    const theirIssues = issuesByProfile.get(p.id) ?? new Set<string>();
    for (const key of myIssues) {
      if (!theirIssues.has(key)) continue;
      score += rarityWeight(issueCounts.get(key) ?? 1, totalProfiles);
      const issue = getWorldIssue(key);
      if (issue) reasons.push(`You've both raised ${issue.label} in the Exchange.`);
    }

    if (score > 0 && reasons.length > 0) matches.push({ profile: p, score, reasons });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

export async function setKindredOptOut(optOut: boolean): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase.from("profiles").update({ kindred_opt_out: optOut }).eq("id", userData.user.id);
}
