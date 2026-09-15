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

// -- "Connect with Same Heart" -- see supabase/schema.sql's
// community_connect_codes comment for the full shape. A community_api_keys
// row doubles as the "app": its id is the public client_id used in the
// /connect link, its plaintext key (never stored) is the private secret
// used only by app/api/v1/connect/exchange.

const CONNECT_CODE_PREFIX = "shc_";

export function generateConnectCode(): { plaintext: string; hash: string } {
  const random = crypto.randomBytes(24).toString("base64url");
  const plaintext = `${CONNECT_CODE_PREFIX}${random}`;
  return { plaintext, hash: hashApiKey(plaintext) };
}

export interface ConnectAppInfo {
  keyId: string;
  communityId: string;
  communityName: string;
  communitySlug: string;
}

// Shared validation between app/api/v1/connect/app (renders the consent
// screen) and app/api/v1/connect/approve (actually grants it) -- both
// must independently confirm the same thing: this client_id is a real,
// unrevoked key, and this exact redirect_uri is one its own creator
// pre-registered for it (see the Developer API panel's redirect-URI
// list). Never trust the earlier check alone; approve() re-derives this
// itself rather than believing anything the page already showed.
export async function resolveConnectApp(clientId: string, redirectUri: string): Promise<ConnectAppInfo | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("community_api_keys")
    .select("id, community_id, revoked_at, redirect_uris, communities(name, slug)")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;
  const uris: string[] = (data as any).redirect_uris ?? [];
  if (!uris.includes(redirectUri)) return null;

  const community = (data as any).communities;
  if (!community) return null;

  return {
    keyId: data.id,
    communityId: data.community_id,
    communityName: community.name,
    communitySlug: community.slug,
  };
}
