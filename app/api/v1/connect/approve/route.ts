import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateConnectCode, resolveConnectApp } from "@/lib/communityApi";

// The one place a real person actually grants a "Connect with Same
// Heart" request -- session-authenticated (their own Supabase token),
// called from app/connect/page.tsx only after they click Approve.
// Membership happens right here, not at exchange, so the consent
// screen's promise is true the instant it's granted -- see
// supabase/schema.sql's community_connect_codes comment.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }

  let body: { clientId?: string; redirectUri?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.clientId || !body.redirectUri) {
    return NextResponse.json({ error: "clientId and redirectUri are required." }, { status: 400 });
  }

  const app = await resolveConnectApp(body.clientId, body.redirectUri);
  if (!app) {
    return NextResponse.json(
      { error: "This connection link isn't valid, or this app isn't set up for that redirect." },
      { status: 400 }
    );
  }

  const profileId = userData.user.id;

  // Join now, for real -- ignore "already a member" (23505), everything
  // else is a genuine failure worth stopping over.
  const { error: joinError } = await admin
    .from("community_members")
    .insert({ community_id: app.communityId, profile_id: profileId });
  if (joinError && joinError.code !== "23505") {
    return NextResponse.json({ error: "Couldn't add you to that community right now." }, { status: 503 });
  }

  const { plaintext, hash } = generateConnectCode();
  const { error: codeError } = await admin.from("community_connect_codes").insert({
    api_key_id: app.keyId,
    community_id: app.communityId,
    profile_id: profileId,
    redirect_uri: body.redirectUri,
    code_hash: hash,
  });
  if (codeError) {
    return NextResponse.json({ error: "Couldn't finish that connection right now." }, { status: 503 });
  }

  return NextResponse.json({ code: plaintext });
}
