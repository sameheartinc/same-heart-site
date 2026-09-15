import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateApiKey } from "@/lib/communityApi";

// Key management for the white-label Communities API (see
// supabase/schema.sql's community_api_keys and lib/communityApi.ts).
// Session-authenticated like every other app/api/* route (a normal
// signed-in person's own Supabase access token) -- NOT API-key
// authenticated, since generating or listing a community's keys is the
// one thing a key itself can never be used to do. Every request
// re-derives "is this really the community's creator" from the
// database rather than trusting anything the client sends, same trust
// model as app/api/monetization/apply.

async function requireCreator(request: NextRequest, communityId: string) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 }) };
  }

  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("id, created_by")
    .eq("id", communityId)
    .maybeSingle();

  if (communityError || !community) {
    return { error: NextResponse.json({ error: "Community not found." }, { status: 404 }) };
  }
  if (community.created_by !== userData.user.id) {
    return {
      error: NextResponse.json(
        { error: "Only a community's own creator can manage its API keys." },
        { status: 403 }
      ),
    };
  }

  return { admin, profileId: userData.user.id };
}

export async function GET(request: NextRequest) {
  const communityId = request.nextUrl.searchParams.get("communityId");
  if (!communityId) return NextResponse.json({ error: "communityId is required." }, { status: 400 });

  const result = await requireCreator(request, communityId);
  if ("error" in result) return result.error;

  const { data, error } = await result.admin
    .from("community_api_keys")
    .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Couldn't load API keys right now." }, { status: 503 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: NextRequest) {
  let body: { communityId?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { communityId, label } = body;
  if (!communityId) return NextResponse.json({ error: "communityId is required." }, { status: 400 });

  const result = await requireCreator(request, communityId);
  if ("error" in result) return result.error;

  const { plaintext, hash, prefix } = generateApiKey();
  const { data, error } = await result.admin
    .from("community_api_keys")
    .insert({
      community_id: communityId,
      created_by: result.profileId,
      label: (label ?? "").trim().slice(0, 80),
      key_hash: hash,
      key_prefix: prefix,
    })
    .select("id, label, key_prefix, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "Couldn't create that key right now." }, { status: 503 });

  // The only time the plaintext key is ever sent anywhere.
  return NextResponse.json({ ...data, key: plaintext });
}
