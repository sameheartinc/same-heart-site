import { supabaseAdmin } from "./supabaseAdmin";
import { getStanding } from "./standing";
import { PRACTICES, leadingPractice, normalizePracticePoints, practiceTier } from "./practices";

// "Realizing initiative" (see the Ignition memo) -- the admin-only,
// never-a-public-leaderboard view of who's actually been stepping up in
// a community lately. Built from what's honestly, cleanly queryable
// with real recency today: thread starts and replies within this
// specific community (commons_threads/commons_replies both carry a
// timestamp and, through the thread, a community_id) and an active
// Kinship streak (kinship_streak_current/_last_date -- global to a
// profile, not community-scoped, since reaching-out isn't tied to one
// community the way a thread is; still a real, current signal, just a
// broader one). There's deliberately no attempt to claim "recent
// Practice points earned": practice_points is a cumulative total with
// no award-by-award history table behind it, so anything claiming
// recency from it would be invented, not observed. Leading Practice and
// its tier are shown as *context* on a person already surfaced by real
// recent activity, never as the reason they're on the list.
//
// Shared by both app/api/commons/initiative (session-authenticated, for
// Same Heart's own community page) and app/api/v1/community/initiative
// (API-key-authenticated, so a business's own dashboard can pull the
// exact same signal) -- one implementation, two doors in, matching
// "package what exists" rather than building this twice.

export interface InitiativeSignal {
  profile_id: string;
  display_name: string | null;
  standing: string;
  leading_practice: string | null;
  leading_practice_tier: number;
  thread_count: number;
  reply_count: number;
  kinship_streak_current: number;
  reason: string;
}

export async function computeInitiativeSignals(
  communityId: string,
  opts: { excludeProfileId?: string; days?: number; limit?: number } = {}
): Promise<InitiativeSignal[]> {
  const days = opts.days ?? 14;
  const limit = opts.limit ?? 8;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const admin = supabaseAdmin();

  // Two queries, not a join -- same posture as lib/commons.ts's
  // listMyConversations, for the same reason: reliable across
  // supabase-js versions beats a clever embedded-relation filter.
  const [threadsResult, communityThreadIdsResult] = await Promise.all([
    admin
      .from("commons_threads")
      .select("profile_id")
      .eq("community_id", communityId)
      .gte("created_at", cutoff),
    admin.from("commons_threads").select("id").eq("community_id", communityId),
  ]);

  const threadCounts = new Map<string, number>();
  for (const row of threadsResult.data ?? []) {
    threadCounts.set(row.profile_id, (threadCounts.get(row.profile_id) ?? 0) + 1);
  }

  const threadIds = (communityThreadIdsResult.data ?? []).map((t) => t.id);
  const replyCounts = new Map<string, number>();
  if (threadIds.length > 0) {
    const { data: replies } = await admin
      .from("commons_replies")
      .select("profile_id")
      .in("thread_id", threadIds)
      .gte("created_at", cutoff);
    for (const row of replies ?? []) {
      replyCounts.set(row.profile_id, (replyCounts.get(row.profile_id) ?? 0) + 1);
    }
  }

  const profileIds = new Set<string>([...threadCounts.keys(), ...replyCounts.keys()]);
  profileIds.delete(opts.excludeProfileId ?? "");
  if (profileIds.size === 0) return [];

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, xp, practice_points, kinship_streak_current, kinship_streak_last_date")
    .in("id", Array.from(profileIds));

  const today = new Date();
  const signals: InitiativeSignal[] = (profiles ?? []).map((p: any) => {
    const threadCount = threadCounts.get(p.id) ?? 0;
    const replyCount = replyCounts.get(p.id) ?? 0;
    const points = normalizePracticePoints(p.practice_points);
    const leading = leadingPractice(points);
    const tier = leading ? practiceTier(points, leading) : 0;

    const lastKinship = p.kinship_streak_last_date ? new Date(p.kinship_streak_last_date) : null;
    const daysSinceKinship = lastKinship
      ? Math.floor((today.getTime() - lastKinship.getTime()) / (24 * 60 * 60 * 1000))
      : Infinity;
    const kinshipActive = (p.kinship_streak_current ?? 0) > 0 && daysSinceKinship <= 2;

    const parts: string[] = [];
    if (threadCount > 0) parts.push(`${threadCount} new discussion${threadCount === 1 ? "" : "s"}`);
    if (replyCount > 0) parts.push(`${replyCount} repl${replyCount === 1 ? "y" : "ies"}`);
    let reason = parts.length > 0 ? `${parts.join(" and ")} here in the last ${days} days` : "";
    if (kinshipActive) {
      reason += `${reason ? " · " : ""}${p.kinship_streak_current}-day streak of reaching out to others`;
    }
    if (leading) {
      reason += `${reason ? " · " : ""}leading in ${PRACTICES[leading].name} (Tier ${tier})`;
    }

    return {
      profile_id: p.id,
      display_name: p.display_name,
      standing: getStanding(p.xp ?? 0),
      leading_practice: leading,
      leading_practice_tier: tier,
      thread_count: threadCount,
      reply_count: replyCount,
      kinship_streak_current: p.kinship_streak_current ?? 0,
      reason,
    };
  });

  // Starting something outweighs replying to something -- initiative,
  // not idle presence, same distinction Practices itself already makes.
  signals.sort((a, b) => b.thread_count * 2 + b.reply_count - (a.thread_count * 2 + a.reply_count));
  return signals.slice(0, limit);
}
