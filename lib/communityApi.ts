import crypto from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

// White-label Communities API (Sep 15, 2026) -- see
// supabase/schema.sql's community_api_keys comment for the full
// reasoning. This file is the only place a plaintext key is ever
// generated or checked; every app/api/v1/community/* route calls
// getApiKeyContext() first and refuses to do anything without a valid,
// unrevoked key. Key management itself (app/api/v1/keys/*) is
// session-authenticated instead -- generating or revoking a key is the
// one thing a key can never be used to do to itself.

const KEY_PREFIX = "sh_live_";

export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

// The plaintext is returned exactly once, in app/api/v1/keys's POST
// response -- only its hash is ever stored, same reasoning as a
// password table.
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(24).toString("base64url");
  const plaintext = `${KEY_PREFIX}${random}`;
  return { plaintext, hash: hashApiKey(plaintext), prefix: plaintext.slice(0, 14) };
}

export interface ApiKeyContext {
  communityId: string;
  keyId: string;
}

// Resolves an "Authorization: Bearer sh_live_..." header to the
// community it's scoped to. Returns null for anything missing,
// malformed, unknown, or revoked -- every caller treats null as a flat
// 401 with no further detail (never confirms/denies whether a given key
// ever existed).
export async function getApiKeyContext(req: Request): Promise<ApiKeyContext | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const key = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!key || !key.startsWith(KEY_PREFIX)) return null;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("community_api_keys")
    .select("id, community_id, revoked_at")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Best-effort activity stamp -- never worth failing the real request
  // over.
  admin
    .from("community_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(
      () => {},
      () => {}
    );

  return { communityId: data.community_id, keyId: data.id };
}
