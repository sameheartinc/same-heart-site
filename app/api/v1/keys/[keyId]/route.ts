import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Revokes a single API key. Session-authenticated, same posture as
// app/api/v1/keys's own route -- see that file's header comment.
export async function DELETE(request: NextRequest, { params }: { params: { keyId: string } }) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }

  const { data: key, error: keyError } = await admin
    .from("community_api_keys")
    .select("id, community_id")
    .eq("id", params.keyId)
    .maybeSingle();
  if (keyError || !key) return NextResponse.json({ error: "Key not found." }, { status: 404 });

  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("created_by")
    .eq("id", key.community_id)
    .maybeSingle();
  if (communityError || !community || community.created_by !== userData.user.id) {
    return NextResponse.json(
      { error: "Only a community's own creator can revoke its API keys." },
      { status: 403 }
    );
  }

  const { error } = await admin
    .from("community_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.keyId);

  if (error) return NextResponse.json({ error: "Couldn't revoke that key right now." }, { status: 503 });
  return NextResponse.json({ ok: true });
}

// Updates this key's redirect-URI allowlist -- the set of URLs the
// /connect consent screen is allowed to hand a code back to for this
// app (see lib/communityApi.ts's resolveConnectApp). Replaces the whole
// list rather than patching one entry, same "resend everything you want
// kept" shape as the memory-write convention elsewhere in this project;
// simplest to reason about from the Developer API panel's own editor.
const MAX_REDIRECT_URIS = 5;

export async function PATCH(request: NextRequest, { params }: { params: { keyId: string } }) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }

  const { data: key, error: keyError } = await admin
    .from("community_api_keys")
    .select("id, community_id")
    .eq("id", params.keyId)
    .maybeSingle();
  if (keyError || !key) return NextResponse.json({ error: "Key not found." }, { status: 404 });

  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("created_by")
    .eq("id", key.community_id)
    .maybeSingle();
  if (communityError || !community || community.created_by !== userData.user.id) {
    return NextResponse.json(
      { error: "Only a community's own creator can manage its API keys." },
      { status: 403 }
    );
  }

  let body: { redirectUris?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.redirectUris)) {
    return NextResponse.json({ error: "redirectUris must be an array." }, { status: 400 });
  }

  const cleaned: string[] = [];
  for (const raw of body.redirectUris) {
    if (typeof raw !== "string") continue;
    const uri = raw.trim();
    if (!uri) continue;
    try {
      const parsed = new URL(uri);
      // https always; http only for localhost, so a business can test
      // its own integration before it has a real domain up.
      if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) {
        return NextResponse.json({ error: `${uri} must be https (or http://localhost for testing).` }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: `${uri} isn't a valid URL.` }, { status: 400 });
    }
    if (!cleaned.includes(uri)) cleaned.push(uri);
  }
  if (cleaned.length > MAX_REDIRECT_URIS) {
    return NextResponse.json({ error: `Up to ${MAX_REDIRECT_URIS} redirect URIs per key.` }, { status: 400 });
  }

  const { error } = await admin
    .from("community_api_keys")
    .update({ redirect_uris: cleaned })
    .eq("id", params.keyId);

  if (error) return NextResponse.json({ error: "Couldn't update that key right now." }, { status: 503 });
  return NextResponse.json({ redirect_uris: cleaned });
}
