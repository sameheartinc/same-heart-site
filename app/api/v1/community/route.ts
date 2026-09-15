import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiKeyContext } from "@/lib/communityApi";

// The white-label Communities API's simplest read -- confirms a key
// works and hands back the community it's scoped to. See
// lib/communityApi.ts for the auth model shared by every route under
// app/api/v1/community/*.
export async function GET(request: NextRequest) {
  const ctx = await getApiKeyContext(request);
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("communities")
    .select("id, slug, name, description, accent, is_private, created_at, community_members(count)")
    .eq("id", ctx.communityId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Couldn't load that community right now." }, { status: 503 });
  }

  const { community_members, ...community } = data as any;
  return NextResponse.json({
    ...community,
    member_count: community_members?.[0]?.count ?? 0,
  });
}
