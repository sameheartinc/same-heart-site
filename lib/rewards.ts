import { supabase } from "./supabaseClient";
import { PathKey } from "./paths";

export type RewardKind = "badge" | "unlock" | "message" | "pass" | "spark";

export interface RewardDef {
  key: string;
  title: string;
  description: string;
  kind: RewardKind;
  pathKey: PathKey | null;
  giftable: boolean;
}

// Mirrors supabase/schema_paths_rewards.sql -- used for instant local
// rendering (icons, copy) without waiting on a round trip. The database
// row is still the source of truth for what a user actually holds.
export const REWARD_CATALOG: Record<string, RewardDef> = {
  first_signal: {
    key: "first_signal",
    title: "First Signal",
    description: "You showed up before the doors even opened.",
    kind: "badge",
    pathKey: null,
    giftable: false,
  },
  path_revealed: {
    key: "path_revealed",
    title: "Named",
    description: "The site quietly recognized which path you walk.",
    kind: "badge",
    pathKey: null,
    giftable: false,
  },
  resonance_pause: {
    key: "resonance_pause",
    title: "Resonance",
    description: "You lingered on the heart long enough for it to notice.",
    kind: "unlock",
    pathKey: null,
    giftable: true,
  },
  guardian_watch: {
    key: "guardian_watch",
    title: "The Watch",
    description: "A steady presence, offered back to you.",
    kind: "message",
    pathKey: "guardian",
    giftable: true,
  },
  seeker_map: {
    key: "seeker_map",
    title: "A Loose Map",
    description: "For someone who was never going to follow a straight line.",
    kind: "message",
    pathKey: "seeker",
    giftable: true,
  },
  weaver_thread: {
    key: "weaver_thread",
    title: "A Spare Thread",
    description: "For tying two people together who hadn't met yet.",
    kind: "message",
    pathKey: "weaver",
    giftable: true,
  },
  flame_spark: {
    key: "flame_spark",
    title: "A Spark",
    description: "Something to hand to the next room you walk into.",
    kind: "message",
    pathKey: "flame",
    giftable: true,
  },
  pay_it_forward: {
    key: "pay_it_forward",
    title: "Pay It Forward",
    description: "A reward you can only ever receive by someone else giving it to you.",
    kind: "spark",
    pathKey: null,
    giftable: true,
  },
  guardian_earth_find: {
    key: "guardian_earth_find",
    title: "A Steady Place",
    description: "You found a patch of ground that doesn't move, even when you do.",
    kind: "unlock",
    pathKey: "guardian",
    giftable: true,
  },
  seeker_star_find: {
    key: "seeker_star_find",
    title: "A Named Star",
    description: "You found the one light that was waiting for you to notice it.",
    kind: "unlock",
    pathKey: "seeker",
    giftable: true,
  },
  weaver_current_find: {
    key: "weaver_current_find",
    title: "A Warm Current",
    description: "You found where the water already knew where it was going.",
    kind: "unlock",
    pathKey: "weaver",
    giftable: true,
  },
  flame_ember_find: {
    key: "flame_ember_find",
    title: "A Live Coal",
    description: "You found the one ember that hadn't gone out yet.",
    kind: "unlock",
    pathKey: "flame",
    giftable: true,
  },
};

export function pathRewardKey(path: PathKey): string {
  return (
    {
      guardian: "guardian_watch",
      seeker: "seeker_map",
      weaver: "weaver_thread",
      flame: "flame_spark",
    } as const
  )[path];
}

export interface GrantResult {
  id: string;
  rewardKey: string;
  grantedAt: string;
  newlyGranted: boolean;
}

export async function grantReward(
  rewardKey: string,
  meta: Record<string, unknown> = {}
): Promise<GrantResult> {
  if (!supabase) throw new Error("supabase not configured");
  const { data, error } = await supabase
    .rpc("grant_reward", { p_reward_key: rewardKey, p_meta: meta })
    .single();
  if (error) throw error;
  const row = data as { id: string; reward_key: string; granted_at: string; newly_granted: boolean };
  return {
    id: row.id,
    rewardKey: row.reward_key,
    grantedAt: row.granted_at,
    newlyGranted: row.newly_granted,
  };
}

export interface MyRewardRow {
  id: string;
  rewardKey: string;
  meta: Record<string, unknown>;
  grantedAt: string;
}

export async function listMyRewards(): Promise<MyRewardRow[]> {
  if (!supabase) throw new Error("supabase not configured");
  const { data, error } = await supabase
    .from("reward_grants")
    .select("id, reward_key, meta, granted_at")
    .order("granted_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    rewardKey: row.reward_key,
    meta: row.meta ?? {},
    grantedAt: row.granted_at,
  }));
}

export async function createGiftCode(rewardKey: string): Promise<string> {
  if (!supabase) throw new Error("supabase not configured");
  const { data, error } = await supabase.rpc("create_gift_code", {
    p_reward_key: rewardKey,
  });
  if (error) throw error;
  return data as string;
}

export async function redeemGiftCode(code: string): Promise<string> {
  if (!supabase) throw new Error("supabase not configured");
  const { data, error } = await supabase.rpc("redeem_gift_code", {
    p_code: code,
  });
  if (error) throw error;
  return data as string;
}
