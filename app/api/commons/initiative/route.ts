import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeInitiativeSignals } from "@/lib/initiative";

// "Who's stepping up" -- session-authenticated, for Same Heart's own
// community page (app/commons/c/[slug]/page.tsx). Creator-only, same
// trust model as app/api/v1/keys: re-derives "is this really the
// community's creator" from the database every time rather than
// trusting the client. See lib/initiative.ts for what this actually
// measures and, just as importantly, what it deliberately doesn't
// claim to measure.
export async function GET(request: NextRequest) {
  const communityId = request.nextUrl.searchParams.get("communityId");
  if (!communityId) return NextResponse.json({ error: "communityId is required." }, { status: 400 });

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }

  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("created_by")
    .eq("id", communityId)
    .maybeSingle();
  if (communityError || !community) {
    return NextResponse.json({ error: "Community not found." }, { status: 404 });
  }
  if (community.created_by !== userData.user.id) {
    return NextResponse.json(
      { error: "Only a community's own creator can see this." },
      { status: 403 }
    );
  }

  const signals = await computeInitiativeSignals(communityId, { excludeProfileId: userData.user.id });
  return NextResponse.json({ signals });
}
