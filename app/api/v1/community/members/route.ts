import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiKeyContext } from "@/lib/communityApi";
import { getStanding } from "@/lib/standing";
import { leadingPractice, normalizePracticePoints } from "@/lib/practices";

const MAX_LIMIT = 100;

// The roster -- read-only, and the whole point of "package what exists"
// as an API: a business can pull their community's real membership and
// engagement (Standing tier, leading Practice) into their own dashboard
// or CRM without anyone hand-exporting a CSV. Exposes nothing a member
// hasn't already made visible elsewhere on the site (PublicProfile's
// own shape in lib/commons.ts) plus xp/standing, which is public by
// design -- see lib/standing.ts's own header comment.
export async function GET(request: NextRequest) {
  const ctx = await getApiKeyContext(request);
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  const limit = Math.min(MAX_LIMIT, Number(request.nextUrl.searchParams.get("limit")) || 25);
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset")) || 0);

  const admin = supabaseAdmin();
  const { data, error, count } = await admin
    .from("community_members")
    .select("joined_at, profiles!inner(id, display_name, xp, practice_points)", { count: "exact" })
    .eq("community_id", ctx.communityId)
    .order("joined_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: "Couldn't load members right now." }, { status: 503 });

  const members = (data ?? []).map((row: any) => {
    const profile = row.profiles;
    const points = normalizePracticePoints(profile.practice_points);
    return {
      profile_id: profile.id,
      display_name: profile.display_name,
      joined_at: row.joined_at,
      xp: profile.xp ?? 0,
      standing: getStanding(profile.xp ?? 0),
      leading_practice: leadingPractice(points),
    };
  });

  return NextResponse.json({ members, total: count ?? members.length, limit, offset });
}

// Adds an existing Same Heart member (by their profile id) to this
// key's community. Deliberately narrow: works only for a public
// community, and only for a profile id the caller already knows --
// there's no lookup-by-email here (profiles carries no email column),
// and no "connect your Same Heart account" handshake yet for an outside
// site to learn a visitor's profile id in the first place. That
// handshake is the natural next stage of this API, not this endpoint --
// see IDEAS.md.
export async function POST(request: NextRequest) {
  const ctx = await getApiKeyContext(request);
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  let body: { profileId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.profileId) return NextResponse.json({ error: "profileId is required." }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("is_private")
    .eq("id", ctx.communityId)
    .single();
  if (communityError || !community) {
    return NextResponse.json({ error: "Couldn't load this community right now." }, { status: 503 });
  }
  if (community.is_private) {
    return NextResponse.json(
      { error: "This community is private -- invite members from the Hub instead." },
      { status: 409 }
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", body.profileId)
    .maybeSingle();
  if (profileError || !profile) {
    return NextResponse.json({ error: "No Same Heart member with that profile id." }, { status: 404 });
  }

  const { error: insertError } = await admin
    .from("community_members")
    .insert({ community_id: ctx.communityId, profile_id: body.profileId });
  if (insertError && insertError.code !== "23505") {
    return NextResponse.json({ error: "Couldn't add that member right now." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
