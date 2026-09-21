import type { SupabaseClient } from "@supabase/supabase-js";
import { getStanding } from "@/lib/standing";
import { getLevel, nextLevelThreshold } from "@/lib/levels";
import { toUTCDateString } from "@/lib/streak";
import {
  ACTIONS,
  CAP_GROUPS,
  MIN_REPLY_CHARS,
  MIN_THREAD_BODY_CHARS,
  MIN_THREAD_TITLE_CHARS,
  MOMENTUM_LOOKBACK_DAYS,
  MOMENTUM_WEIGHT_BY_LOG_CATEGORY,
  REPUTATION_POINTS,
  applyBoost,
  combineBoost,
  diminishingMultiplier,
  getAction,
  momentumBoostPercent,
  momentumFromEvents,
  normalizeForDuplicateCheck,
  reputationFromSignals,
  streakBoostPercent,
  type BoostPart,
  type ReputationSignal,
  type WeightedEvent,
} from "@/lib/xpActions";

// SERVER ONLY -- takes the service-role client from lib/supabaseAdmin.ts
// and is the single place XP is granted for anything configured in
// lib/xpActions.ts. The client never says how much XP it earned or that
// it earned any: it says "I did this action to this row," and everything
// below is re-derived from the database.

type Admin = SupabaseClient;

const DAY_MS = 24 * 60 * 60 * 1000;
// A target must be fresh: this endpoint pays for something you just did,
// not for digging up old rows.
const TARGET_MAX_AGE_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AwardResult {
  awarded: number;
  reason?: string;
  boostPercent?: number;
}

type Verdict = { ok: true; quality: number; reason?: string } | { ok: false; reason: string };

// -- Verification ------------------------------------------------------------
// One case per action. Each one confirms the row the client points at is
// real, is the caller's own, and is fresh -- then judges whether it's
// meaningful. quality 0 means "real but worth nothing" (too short, a
// repeat, talking to yourself); it is not an error.

async function verifyAction(admin: Admin, profileId: string, actionKey: string, targetId: string): Promise<Verdict> {
  if (!UUID.test(targetId)) return { ok: false, reason: "bad_target" };

  switch (actionKey) {
    case "start_thread": {
      const { data: thread } = await admin
        .from("commons_threads")
        .select("profile_id, title, body, created_at")
        .eq("id", targetId)
        .maybeSingle();
      if (!thread || thread.profile_id !== profileId) return { ok: false, reason: "not_yours" };
      if (Date.now() - Date.parse(thread.created_at) > TARGET_MAX_AGE_MS) return { ok: false, reason: "too_old" };
      if (thread.title.trim().length < MIN_THREAD_TITLE_CHARS || thread.body.trim().length < MIN_THREAD_BODY_CHARS) {
        return { ok: true, quality: 0, reason: "too_short" };
      }
      return { ok: true, quality: 1 };
    }

    case "reply": {
      const { data: reply } = await admin
        .from("commons_replies")
        .select("profile_id, thread_id, body, created_at")
        .eq("id", targetId)
        .maybeSingle();
      if (!reply || reply.profile_id !== profileId) return { ok: false, reason: "not_yours" };
      if (Date.now() - Date.parse(reply.created_at) > TARGET_MAX_AGE_MS) return { ok: false, reason: "too_old" };

      // Talking to yourself isn't participation -- it's the easiest way
      // to farm a cap with one account.
      const { data: thread } = await admin.from("commons_threads").select("profile_id").eq("id", reply.thread_id).maybeSingle();
      if (!thread) return { ok: false, reason: "no_thread" };
      if (thread.profile_id === profileId) return { ok: true, quality: 0, reason: "own_thread" };

      if (reply.body.trim().length < MIN_REPLY_CHARS) return { ok: true, quality: 0, reason: "too_short" };

      const { data: recent } = await admin
        .from("commons_replies")
        .select("body")
        .eq("profile_id", profileId)
        .neq("id", targetId)
        .gte("created_at", new Date(Date.now() - 7 * DAY_MS).toISOString())
        .limit(200);
      const mine = normalizeForDuplicateCheck(reply.body);
      if ((recent ?? []).some((r) => normalizeForDuplicateCheck(r.body) === mine)) {
        return { ok: true, quality: 0, reason: "repeat" };
      }
      return { ok: true, quality: 1 };
    }

    default:
      return { ok: false, reason: "unknown_action" };
  }
}

// -- Boost --------------------------------------------------------------------

export interface BoostSnapshot {
  momentum: number;
  streak: number;
  parts: BoostPart[];
  total: number;
}

export async function loadBoost(admin: Admin, profileId: string, nowMs = Date.now()): Promise<BoostSnapshot> {
  const since = new Date(nowMs - MOMENTUM_LOOKBACK_DAYS * DAY_MS).toISOString();

  const [logResult, profileResult, boostResult] = await Promise.all([
    admin
      .from("log_entries")
      .select("occurred_at, category")
      .eq("profile_id", profileId)
      .gt("xp_awarded", 0)
      .gte("occurred_at", since),
    admin.from("profiles").select("current_streak, last_visit_date").eq("id", profileId).maybeSingle(),
    admin.from("profile_boosts").select("source, label, percent").eq("profile_id", profileId).gt("expires_at", new Date(nowMs).toISOString()),
  ]);

  const events: WeightedEvent[] = (logResult.data ?? []).flatMap((row) => {
    const weight = MOMENTUM_WEIGHT_BY_LOG_CATEGORY[row.category as string] ?? 0;
    return weight > 0 ? [{ atMs: Date.parse(row.occurred_at as string), weight }] : [];
  });
  const momentum = momentumFromEvents(events, nowMs);

  // The stored streak only changes at check-in, so a lapsed one lingers in
  // the column until the next visit -- count it only while it's still alive.
  const yesterday = toUTCDateString(new Date(nowMs - DAY_MS));
  const lastVisit = (profileResult.data?.last_visit_date as string | null) ?? null;
  const streak = lastVisit && lastVisit >= yesterday ? (profileResult.data?.current_streak as number) ?? 0 : 0;

  const parts: BoostPart[] = [
    { source: "momentum", label: "Momentum", percent: momentumBoostPercent(momentum) },
    { source: "streak", label: "Streak", percent: streakBoostPercent(streak) },
    ...(boostResult.data ?? []).map((b) => ({ source: b.source as string, label: b.label as string, percent: b.percent as number })),
  ].filter((p) => p.percent > 0);

  return { momentum, streak, parts, total: combineBoost(parts) };
}

// -- Awarding ------------------------------------------------------------------

export async function awardAction(admin: Admin, profileId: string, actionKey: string, targetId: string): Promise<AwardResult> {
  const action = getAction(actionKey);
  if (!action || !action.enabled) return { awarded: 0, reason: "unknown_action" };

  const verdict = await verifyAction(admin, profileId, actionKey, targetId);
  if (!verdict.ok) return { awarded: 0, reason: verdict.reason };
  if (verdict.quality <= 0) return { awarded: 0, reason: verdict.reason ?? "not_meaningful" };

  const { data: already } = await admin
    .from("xp_events")
    .select("id")
    .eq("profile_id", profileId)
    .eq("action", actionKey)
    .eq("target_id", targetId)
    .maybeSingle();
  if (already) return { awarded: 0, reason: "already_awarded" };

  const now = Date.now();

  if (action.cooldownSeconds) {
    const { data: recent } = await admin
      .from("xp_events")
      .select("id")
      .eq("profile_id", profileId)
      .eq("action", actionKey)
      .gte("created_at", new Date(now - action.cooldownSeconds * 1000).toISOString())
      .limit(1);
    if (recent && recent.length > 0) return { awarded: 0, reason: "cooldown" };
  }

  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count: countToday } = await admin
    .from("xp_events")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("action", actionKey)
    .gte("created_at", startOfDay.toISOString());

  let base = Math.round(action.baseXp * verdict.quality * diminishingMultiplier(action, countToday ?? 0));

  const group = action.capGroup ? CAP_GROUPS[action.capGroup] : null;
  if (group && action.capGroup) {
    const groupActions = Object.values(ACTIONS)
      .filter((a) => a.capGroup === action.capGroup)
      .map((a) => a.key);
    const { data: todays, error: todaysError } = await admin
      .from("xp_events")
      .select("base_xp")
      .eq("profile_id", profileId)
      .in("action", groupActions)
      .gte("created_at", startOfDay.toISOString());
    if (todaysError) {
      console.error("XP engine: daily total lookup failed:", todaysError.message);
      return { awarded: 0, reason: "error" };
    }
    const usedToday = (todays ?? []).reduce((sum, r) => sum + (r.base_xp ?? 0), 0);
    base = Math.min(base, Math.max(0, group.dailyBaseXp - usedToday));
  }
  if (base <= 0) return { awarded: 0, reason: "daily_cap" };

  const boost = await loadBoost(admin, profileId, now);
  let amount = applyBoost(base, boost.total);

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .select("xp, double_xp_until")
    .eq("id", profileId)
    .single();
  if (profileError || !profileRow) {
    console.error("XP engine: profile read failed:", profileError?.message);
    return { awarded: 0, reason: "error" };
  }

  // Double XP Hour (see lib/evolution.ts's "ability-double-xp") is its
  // own earned ability, separate from Boost, and stays exactly as it was:
  // doubling applied after the cap.
  if (profileRow.double_xp_until && Date.parse(profileRow.double_xp_until) > now) amount *= 2;

  // Claim the target first. The unique index makes this the real
  // once-only guarantee -- a second request racing this one fails here.
  const { data: eventRow, error: eventError } = await admin
    .from("xp_events")
    .insert({
      profile_id: profileId,
      action: actionKey,
      category: action.category,
      target_id: targetId,
      base_xp: base,
      xp_awarded: amount,
      boost_percent: boost.total,
    })
    .select("id")
    .single();
  if (eventError) {
    if (eventError.code === "23505") return { awarded: 0, reason: "already_awarded" };
    console.error("XP engine: ledger insert failed:", eventError.message);
    return { awarded: 0, reason: "error" };
  }

  const newXp = (profileRow.xp ?? 0) + amount;
  const { error: updateError } = await admin
    .from("profiles")
    .update({ xp: newXp, standing: getStanding(newXp) })
    .eq("id", profileId);
  if (updateError) {
    console.error("XP engine: profile update failed:", updateError.message);
    await admin.from("xp_events").delete().eq("id", eventRow.id);
    return { awarded: 0, reason: "error" };
  }

  await admin.from("log_entries").insert({
    profile_id: profileId,
    description: action.logDescription,
    category: action.logCategory,
    xp_awarded: amount,
  });

  return { awarded: amount, boostPercent: boost.total };
}

// -- Reputation ----------------------------------------------------------------

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Built only from what *other people* did to this person's contributions
// (see lib/xpActions.ts's REPUTATION notes for why and how it's capped).
export async function computeReputation(admin: Admin, profileId: string): Promise<number> {
  const [threadsResult, repliesResult] = await Promise.all([
    admin.from("commons_threads").select("id").eq("profile_id", profileId).limit(2000),
    admin.from("commons_replies").select("id").eq("profile_id", profileId).limit(2000),
  ]);
  const threadIds = (threadsResult.data ?? []).map((t) => t.id as string);
  const replyIds = (repliesResult.data ?? []).map((r) => r.id as string);

  const signals: ReputationSignal[] = [];

  for (const [targetType, ids] of [["thread", threadIds], ["reply", replyIds]] as const) {
    for (const batch of chunk(ids, 100)) {
      const { data } = await admin
        .from("commons_reactions")
        .select("profile_id")
        .eq("target_type", targetType)
        .eq("kind", "heartfelt")
        .in("target_id", batch);
      for (const row of data ?? []) {
        signals.push({ fromProfileId: row.profile_id as string, points: REPUTATION_POINTS.heartfeltReaction });
      }
    }
  }

  for (const batch of chunk(threadIds, 100)) {
    const { data } = await admin.from("commons_replies").select("profile_id, thread_id").in("thread_id", batch);
    const seen = new Set<string>();
    for (const row of data ?? []) {
      const key = `${row.profile_id}:${row.thread_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      signals.push({ fromProfileId: row.profile_id as string, points: REPUTATION_POINTS.replyToYourThread });
    }
  }

  return reputationFromSignals(signals, profileId);
}

// -- The progression summary ------------------------------------------------------

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

export async function getProgression(admin: Admin, profileId: string): Promise<Progression | null> {
  const { data: profile } = await admin.from("profiles").select("xp").eq("id", profileId).maybeSingle();
  if (!profile) return null;
  const xp = (profile.xp as number) ?? 0;
  const [boost, reputation] = await Promise.all([loadBoost(admin, profileId), computeReputation(admin, profileId)]);
  return {
    xp,
    level: getLevel(xp),
    nextLevelXp: nextLevelThreshold(xp),
    standing: getStanding(xp),
    momentum: boost.momentum,
    streak: boost.streak,
    boost: { total: boost.total, parts: boost.parts },
    reputation,
  };
}
