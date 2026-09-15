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
