import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiKeyContext, hashApiKey } from "@/lib/communityApi";
import { getStanding } from "@/lib/standing";
import { leadingPractice, normalizePracticePoints } from "@/lib/practices";

// Redeems a one-time connect code for the profile it belongs to.
// API-key-authenticated (the business's own secret key, server-side
// only -- never the public client_id) -- see lib/communityApi.ts's
// getApiKeyContext. A code only redeems for the same key that was used
// as client_id when it was granted, same as OAuth requiring the client
// secret to match the client id a code was issued to.
export async function POST(request: NextRequest) {
  const ctx = await getApiKeyContext(request);
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.code) return NextResponse.json({ error: "code is required." }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: connectCode, error: codeError } = await admin
    .from("community_connect_codes")
    .select("id, api_key_id, community_id, profile_id, expires_at, used_at")
    .eq("code_hash", hashApiKey(body.code))
    .maybeSingle();

  if (
    codeError ||
    !connectCode ||
    connectCode.api_key_id !== ctx.keyId ||
    connectCode.used_at ||
    new Date(connectCode.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ error: "That code is invalid or has expired." }, { status: 400 });
  }

  const { error: markUsedError } = await admin
    .from("community_connect_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", connectCode.id)
    .is("used_at", null);
  if (markUsedError) {
    return NextResponse.json({ error: "Couldn't complete that exchange right now." }, { status: 503 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, display_name, xp, practice_points")
    .eq("id", connectCode.profile_id)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Couldn't load that member right now." }, { status: 503 });
  }

  const points = normalizePracticePoints(profile.practice_points);
  return NextResponse.json({
    profile_id: profile.id,
    display_name: profile.display_name,
    xp: profile.xp ?? 0,
    standing: getStanding(profile.xp ?? 0),
    leading_practice: leadingPractice(points),
    joined: true,
  });
}
