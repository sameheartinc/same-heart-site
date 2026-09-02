import { supabase } from "@/lib/supabaseClient";

// The Commons -- v1. This is the real, functional core of the much
// bigger vision (see README): communities, discussions/questions, and
// replies, all backed by real Supabase tables, plus a lightweight
// "who's around right now" presence signal. The cinematic sphere,
// AI-assisted discovery, news pipeline, projects, and Exchange-impact
// tracking are later phases -- this file only covers what's actually
// wired up today.

export interface PublicProfile {
  id: string;
  display_name: string | null;
  spark_id: number | null;
  path_key: string | null;
  ship_skin: string | null;
  designation: string | null;
  commons_accent: string | null;
  kindred_opt_out: boolean;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  created_by: string;
  created_at: string;
  member_count: number;
}

export interface CommonsThread {
  id: string;
  community_id: string | null;
  profile_id: string;
  kind: "discussion" | "question";
  title: string;
  body: string;
  created_at: string;
  reply_count: number;
  last_activity_at: string;
}

export interface CommonsReply {
  id: string;
  thread_id: string;
  profile_id: string;
  body: string;
  created_at: string;
}

// Heartfelt / Heartache -- Rob's own idea for a way to react to a post
// in the Commons. Deliberately NOT an upvote/downvote pair: both are
// positive, honest emotional signals -- Heartfelt for something warm or
// uplifting, Heartache for something that landed because it's hard or
// sad -- not a way to pile on or bury a post. One reaction per person
// per post (switching kinds replaces it, clicking the same kind again
// clears it), so this is a mood signal, never a vote count to win.
export type ReactionKind = "heartfelt" | "heartache";
export type ReactionTargetType = "thread" | "reply";

export interface ReactionSummary {
  heartfelt: number;
  heartache: number;
  mine: ReactionKind | null;
}

export interface CommonsNotification {
  id: string;
  actor_id: string | null;
  kind: string;
  thread_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
}

// Batch-fetch just the public-safe fields for a set of authors, and
// return them as a lookup map keyed by id. Threads/replies/communities
// only store profile_id -- this is the one place author display data
// gets attached, client-side, rather than relying on a PostgREST
// relationship embed against a view.
//
// This calls the get_public_profiles() function (see supabase/schema.sql)
// rather than selecting from a "public_profiles" view. A view here would
// need to run as its owner to see past everyone else's row (profiles'
// real RLS policy is "auth.uid() = id" only) -- Supabase's Security
// Advisor flags that pattern as a critical "Security Definer View" even
// when it's this intentional and this narrow. A SECURITY DEFINER
// function with the same fixed, safe column list does the identical job
// without ever tripping that check, and profiles' own RLS never changes.
export async function fetchProfilesByIds(ids: string[]): Promise<Record<string, PublicProfile>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase.rpc("get_public_profiles", { p_ids: unique });
  if (error || !data) return {};
  const map: Record<string, PublicProfile> = {};
  for (const row of data as PublicProfile[]) map[row.id] = row;
  return map;
}

export function authorName(profile: PublicProfile | undefined, fallback = "Someone") {
  if (!profile) return fallback;
  if (profile.display_name && profile.display_name.trim()) return profile.display_name;
  if (profile.spark_id) return `Spark #${String(profile.spark_id).padStart(5, "0")}`;
  return fallback;
}

// Marks the current user as "around" -- called once when a Commons page
// mounts. Cheap, no realtime subscription needed: presence is just
// "updated their own last_seen recently," read back with presenceCount().
export async function touchPresence(userId: string) {
  await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", userId);
}

// Real, honest activity numbers -- no simulated/fake counts. Each of
// these is a genuine count against the live database at the moment the
// page loads.
export async function fetchCommonsStats() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [humans, communities, activeThreads] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen", fiveMinAgo),
    supabase.from("communities").select("id", { count: "exact", head: true }),
    supabase
      .from("commons_threads")
      .select("id", { count: "exact", head: true })
      .gte("last_activity_at", dayAgo),
  ]);

  return {
    humansPresent: humans.count ?? 0,
    communitiesActive: communities.count ?? 0,
    activeConversations: activeThreads.count ?? 0,
  };
}

export interface NewsArticle {
  id: string;
  source_name: string | null;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  published_at: string | null;
}

// The Signal -- real headlines, fetched hourly by the Vercel Cron job
// (see app/api/cron/fetch-news). This just reads what's already stored;
// it never fetches from NewsAPI/RSS directly.
export async function fetchSignal(limit = 8): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from("news_articles")
    .select("id, source_name, title, description, url, image_url, published_at")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return data as NewsArticle[];
}

// Yellow key instrumentation -- records that someone actually clicked
// through to a real Signal article. Fire-and-forget on purpose: this
// should never slow down or block someone actually opening the link.
// The unique(profile_id, article_id) constraint means a second click on
// the same article is a harmless no-op, not a duplicate count.
export async function recordSignalEngagement(profileId: string, articleId: string) {
  try {
    await supabase.from("signal_engagement").insert({ profile_id: profileId, article_id: articleId });
  } catch {
    // Best-effort -- never worth surfacing an error over a click.
  }
}

export async function listCommunities(): Promise<Community[]> {
  const { data, error } = await supabase
    .from("communities")
    .select("*, community_members(count)")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row: any) => ({
    ...row,
    member_count: row.community_members?.[0]?.count ?? 0,
  }));
}

export async function getCommunityBySlug(slug: string): Promise<Community | null> {
  const { data, error } = await supabase
    .from("communities")
    .select("*, community_members(count)")
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return { ...data, member_count: (data as any).community_members?.[0]?.count ?? 0 };
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createCommunity(input: {
  name: string;
  description: string;
  accent: string;
  createdBy: string;
}) {
  const slug = slugify(input.name) || `community-${Date.now()}`;
  const { data, error } = await supabase
    .from("communities")
    .insert({
      slug,
      name: input.name.trim(),
      description: input.description.trim(),
      accent: input.accent,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  // The creator is automatically the first member.
  await supabase.from("community_members").insert({ community_id: data.id, profile_id: input.createdBy });
  return data as Community;
}

export async function joinCommunity(communityId: string, profileId: string) {
  const { error } = await supabase
    .from("community_members")
    .insert({ community_id: communityId, profile_id: profileId });
  if (error && error.code !== "23505") throw error; // 23505 = already a member, fine
}

export async function isCommunityMember(communityId: string, profileId: string) {
  const { data } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("community_id", communityId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return Boolean(data);
}

export async function listThreads(opts: {
  communityId?: string;
  kind?: "discussion" | "question";
  search?: string;
  limit?: number;
}): Promise<CommonsThread[]> {
  let query = supabase
    .from("commons_threads")
    .select("*, commons_replies(count)")
    .order("last_activity_at", { ascending: false });
  if (opts.communityId) query = query.eq("community_id", opts.communityId);
  if (opts.kind) query = query.eq("kind", opts.kind);
  if (opts.search && opts.search.trim()) {
    const term = opts.search.trim();
    query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  }
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as any[]).map((row) => ({
    ...row,
    reply_count: row.commons_replies?.[0]?.count ?? 0,
  })) as CommonsThread[];
}

// "My Conversations" -- every thread someone's either started or
// replied to, most recently active first. Two queries, not a join:
// commons_threads has no column recording who's replied to it, so this
// mirrors the same "own threads + replied threads" shape the Blue key's
// eligibility check already uses in app/api/keys/evaluate/route.ts.
// Only ever reads what's already visible to this user through normal
// RLS (commons_threads/commons_replies select policies are public) --
// nothing new to secure here.
export async function listMyConversations(profileId: string): Promise<CommonsThread[]> {
  const [authoredResult, repliedResult] = await Promise.all([
    supabase.from("commons_threads").select("*, commons_replies(count)").eq("profile_id", profileId),
    supabase.from("commons_replies").select("thread_id").eq("profile_id", profileId),
  ]);

  const threadsById = new Map<string, CommonsThread>();
  for (const row of (authoredResult.data ?? []) as any[]) {
    threadsById.set(row.id, { ...row, reply_count: row.commons_replies?.[0]?.count ?? 0 });
  }

  const repliedIds = Array.from(
    new Set(
      (repliedResult.data ?? [])
        .map((r) => r.thread_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  ).filter((id) => !threadsById.has(id));

  if (repliedIds.length > 0) {
    const { data: repliedThreads } = await supabase
      .from("commons_threads")
      .select("*, commons_replies(count)")
      .in("id", repliedIds);
    for (const row of (repliedThreads ?? []) as any[]) {
      threadsById.set(row.id, { ...row, reply_count: row.commons_replies?.[0]?.count ?? 0 });
    }
  }

  return Array.from(threadsById.values()).sort(
    (a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
  );
}

export async function getThread(id: string): Promise<CommonsThread | null> {
  const { data, error } = await supabase.from("commons_threads").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as CommonsThread;
}

export async function createThread(input: {
  communityId: string | null;
  profileId: string;
  kind: "discussion" | "question";
  title: string;
  body: string;
}) {
  const { data, error } = await supabase
    .from("commons_threads")
    .insert({
      community_id: input.communityId,
      profile_id: input.profileId,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body.trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as CommonsThread;
}

export async function listReplies(threadId: string): Promise<CommonsReply[]> {
  const { data, error } = await supabase
    .from("commons_replies")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as CommonsReply[];
}

export async function createReply(input: { threadId: string; profileId: string; body: string }) {
  const { data, error } = await supabase
    .from("commons_replies")
    .insert({ thread_id: input.threadId, profile_id: input.profileId, body: input.body.trim() })
    .select()
    .single();
  if (error) throw error;
  // Bumping the thread's own last_activity_at is what makes "active
  // conversations" and sort-by-activity actually mean something. Goes
  // through a narrow RPC (see schema.sql) rather than a direct table
  // update, since there's deliberately no general update policy on
  // commons_threads.
  await supabase.rpc("bump_thread_activity", { thread_id: input.threadId });

  // Let the thread's author know, unless they just replied to their own
  // thread. Also a narrow RPC (see schema.sql) -- the same posture as
  // bump_thread_activity, a controlled write into someone else's data,
  // not an open one. Best-effort: a notification failing should never
  // block the reply itself from posting.
  try {
    await supabase.rpc("notify_thread_reply", { p_thread_id: input.threadId });
  } catch (err) {
    console.error("notify_thread_reply failed:", err);
  }

  // A small Heartbeats reward for participating -- capped low and kept
  // separate from the Exchange, so replying is real but modest next to
  // actually transmitting genuine impact. Goes through a server route
  // (app/api/commons/award-reply/route.ts) rather than writing xp/standing
  // straight from here -- see that route's comment for why. Best-effort:
  // never let this block the reply itself from posting.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      await fetch("/api/commons/award-reply", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch (err) {
    console.error("reply Heartbeats award failed:", err);
  }

  return data as CommonsReply;
}

// Notifications -- read is client-side (RLS: "your own notifications
// only"); marking read is a direct client update too, the same pattern
// already used for Skin selection -- no server route needed since the
// RLS policy already restricts it to your own rows, and nothing of real
// value (XP, keys, money) rides on this table.
// Batch-fetch Heartfelt/Heartache counts (plus the current person's own
// reaction, if any) for a set of targets that are all the same type --
// call once for a thread id and once for a batch of reply ids, same
// pattern as fetchProfilesByIds above. Returns a summary for every id
// passed in, even ones with zero reactions, so callers never need to
// guess at a default.
export async function fetchReactionSummaries(
  targetType: ReactionTargetType,
  targetIds: string[],
  profileId: string | null
): Promise<Record<string, ReactionSummary>> {
  const unique = Array.from(new Set(targetIds)).filter(Boolean);
  const summaries: Record<string, ReactionSummary> = {};
  for (const id of unique) summaries[id] = { heartfelt: 0, heartache: 0, mine: null };
  if (unique.length === 0) return summaries;
  const { data, error } = await supabase
    .from("commons_reactions")
    .select("target_id, kind, profile_id")
    .eq("target_type", targetType)
    .in("target_id", unique);
  if (error || !data) return summaries;
  for (const row of data as Array<{ target_id: string; kind: ReactionKind; profile_id: string }>) {
    const bucket = summaries[row.target_id];
    if (!bucket) continue;
    if (row.kind === "heartfelt") bucket.heartfelt += 1;
    else bucket.heartache += 1;
    if (profileId && row.profile_id === profileId) bucket.mine = row.kind;
  }
  return summaries;
}

// Toggling logic lives here, not in every page that reacts to something:
// picking the reaction you already have clears it, picking the other one
// switches it, and picking one with nothing set yet creates it. Returns
// the new "mine" state so the caller can update its local summary without
// a full re-fetch.
export async function setReaction(
  targetType: ReactionTargetType,
  targetId: string,
  profileId: string,
  kind: ReactionKind,
  current: ReactionKind | null
): Promise<ReactionKind | null> {
  if (current === kind) {
    await supabase
      .from("commons_reactions")
      .delete()
      .eq("profile_id", profileId)
      .eq("target_type", targetType)
      .eq("target_id", targetId);
    return null;
  }
  await supabase
    .from("commons_reactions")
    .upsert(
      { profile_id: profileId, target_type: targetType, target_id: targetId, kind },
      { onConflict: "profile_id,target_type,target_id" }
    );
  return kind;
}

export interface TrendingThread {
  id: string;
  title: string;
  score: number;
}

// "Floating ideas getting more attention" -- Rob's own phrase (Sep 2,
// 2026) for surfacing real community engagement to people who've
// engaged enough themselves to have leveled up a few times (see
// app/hub/page.tsx's TRENDING_UNLOCK_LEVEL). Score is deliberately just
// replies plus Heartfelt/Heartache reactions added together -- real
// people choosing to respond or react, not views or any other passive
// metric -- and a thread needs a real minimum before it counts as
// "trending" at all, so a single lonely reply never gets called out as
// attention. Candidates come from listThreads' own most-recently-active
// ordering, so this naturally favors current conversations over old
// ones without a separate date filter.
const TRENDING_MIN_SCORE = 3;

export async function getTrendingThread(): Promise<TrendingThread | null> {
  const candidates = await listThreads({ limit: 40 });
  if (candidates.length === 0) return null;
  const reactions = await fetchReactionSummaries(
    "thread",
    candidates.map((t) => t.id),
    null
  );
  let best: TrendingThread | null = null;
  for (const t of candidates) {
    const r = reactions[t.id] ?? { heartfelt: 0, heartache: 0, mine: null };
    const score = t.reply_count + r.heartfelt + r.heartache;
    if (score < TRENDING_MIN_SCORE) continue;
    if (!best || score > best.score) best = { id: t.id, title: t.title, score };
  }
  return best;
}

export async function listMyNotifications(limit = 20): Promise<CommonsNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, actor_id, kind, thread_id, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as CommonsNotification[];
}

export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
}

