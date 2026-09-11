"use client";

// Local-first fallback so the experience works the moment you open it,
// with zero Supabase setup. Once Supabase is configured (env vars set,
// schema run, anonymous sign-ins enabled), rewards.ts additionally syncs
// the same events server-side -- this local copy keeps rendering
// instantly either way and never blocks on the network.

const PATH_STORAGE_KEY = "sh_path";
const REWARDS_STORAGE_KEY = "sh_rewards";
const GIFT_CODES_STORAGE_KEY = "sh_gift_codes";

export interface StoredPath {
  path: string;
  confidence: number;
  assignedAt: string;
}

export function loadStoredPath(): StoredPath | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PATH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPath) : null;
  } catch {
    return null;
  }
}

export function saveStoredPath(path: string, confidence: number): StoredPath {
  const record: StoredPath = { path, confidence, assignedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify(record));
  }
  return record;
}

export function loadLocalRewardKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REWARDS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// Returns true only the first time this key is granted on this device.
export function grantLocalReward(key: string): boolean {
  if (typeof window === "undefined") return false;
  const current = loadLocalRewardKeys();
  if (current.includes(key)) return false;
  current.push(key);
  window.localStorage.setItem(REWARDS_STORAGE_KEY, JSON.stringify(current));
  return true;
}

interface LocalGiftCodeMap {
  [code: string]: { rewardKey: string; redeemed: boolean };
}

function loadGiftCodeMap(): LocalGiftCodeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GIFT_CODES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalGiftCodeMap) : {};
  } catch {
    return {};
  }
}

export function createLocalGiftCode(rewardKey: string): string {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const map = loadGiftCodeMap();
  map[code] = { rewardKey, redeemed: false };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GIFT_CODES_STORAGE_KEY, JSON.stringify(map));
  }
  return code;
}

export function redeemLocalGiftCode(code: string): string | null {
  const map = loadGiftCodeMap();
  const entry = map[code.toUpperCase()];
  if (!entry || entry.redeemed) return null;
  entry.redeemed = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GIFT_CODES_STORAGE_KEY, JSON.stringify(map));
  }
  grantLocalReward(entry.rewardKey);
  return entry.rewardKey;
}
