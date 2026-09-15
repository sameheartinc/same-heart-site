import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiKeyContext } from "@/lib/communityApi";

async function threadInThisCommunity(
  admin: ReturnType<typeof supabaseAdmin>,
  threadId: string,
  communityId: string
) {
  const { data } = await admin
    .from("commons_threads")
    .select("id, community_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!data || data.community_id !== communityId) return null;
  return data;
}

export async function GET(request: NextRequest, { params }: { params: { threadId: string } }) {
  const ctx = await getApiKeyContext(request);
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  const admin = supabaseAdmin();
  const thread = await threadInThisCommunity(admin, params.threadId, ctx.communityId);
  if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

  const { data, error } = await admin
    .from("commons_replies")
    .select("id, body, created_at, profiles(display_name)")
    .eq("thread_id", params.threadId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Couldn't load replies right now." }, { status: 503 });

  const replies = (data ?? []).map((row: any) => ({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    author_display_name: row.profiles?.display_name ?? null,
  }));
  return NextResponse.json({ replies });
}

// Posts a reply into this thread, authored as the community's own
// creator -- same reasoning as app/api/v1/community/threads's POST.
export async function POST(request: NextRequest, { params }: { params: { threadId: string } }) {
  const ctx = await getApiKeyContext(request);
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const text = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "body is required." }, { status: 400 });

  const admin = supabaseAdmin();
  const thread = await threadInThisCommunity(admin, params.threadId, ctx.communityId);
  if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("created_by")
    .eq("id", ctx.communityId)
    .single();
  if (communityError || !community?.created_by) {
    return NextResponse.json({ error: "Couldn't post that right now." }, { status: 503 });
  }

  const { data, error } = await admin
    .from("commons_replies")
    .insert({ thread_id: params.threadId, profile_id: community.created_by, body: text.slice(0, 20000) })
    .select("id, body, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "Couldn't post that right now." }, { status: 503 });

  // Keep the thread's own "recently active" ordering honest for a
  // reply posted through the API too, same as createReply's client-side
  // counterpart does.
  await admin
    .from("commons_threads")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", params.threadId);

  return NextResponse.json(data);
}
