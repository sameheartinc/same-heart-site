import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiKeyContext } from "@/lib/communityApi";

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const ctx = await getApiKeyContext(request);
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  const limit = Math.min(MAX_LIMIT, Number(request.nextUrl.searchParams.get("limit")) || 20);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("commons_threads")
    .select(
      "id, kind, title, body, created_at, last_activity_at, profile_id, profiles(display_name), commons_replies(count)"
    )
    .eq("community_id", ctx.communityId)
    .order("last_activity_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: "Couldn't load discussions right now." }, { status: 503 });

  const threads = (data ?? []).map((row: any) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    created_at: row.created_at,
    last_activity_at: row.last_activity_at,
    author_display_name: row.profiles?.display_name ?? null,
    reply_count: row.commons_replies?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ threads });
}

// Posts a new discussion or question into this key's community,
// authored as the community's own creator -- there's no per-end-user
// identity on the other side of an API key, so API-created content
// reads as coming from whoever created the community, the same way a
// brand's own posts on their own community would. Deliberately awards
// no Heartbeats XP: that reward exists to recognize a real person
// showing up, and a scripted key could otherwise farm its own creator's
// XP by posting on a timer.
export async function POST(request: NextRequest) {
  const ctx = await getApiKeyContext(request);
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  let body: { title?: string; body?: string; kind?: "discussion" | "question" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!title || !text) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("created_by")
    .eq("id", ctx.communityId)
    .single();
  if (communityError || !community?.created_by) {
    return NextResponse.json({ error: "Couldn't post that right now." }, { status: 503 });
  }

  const { data, error } = await admin
    .from("commons_threads")
    .insert({
      community_id: ctx.communityId,
      profile_id: community.created_by,
      kind: body.kind === "question" ? "question" : "discussion",
      title: title.slice(0, 300),
      body: text.slice(0, 20000),
    })
    .select("id, kind, title, body, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "Couldn't post that right now." }, { status: 503 });
  return NextResponse.json(data);
}
