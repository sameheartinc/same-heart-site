import { NextRequest, NextResponse } from "next/server";
import { resolveConnectApp } from "@/lib/communityApi";

// Public, unauthenticated -- lets app/connect/page.tsx confirm a
// client_id + redirect_uri pair is real *before* it ever shows a person
// a consent screen or lets them approve anything. Returns only what's
// already public (a community's name/slug) plus its client_id;
// approve() below re-checks the exact same thing server-side rather
// than trusting this earlier read.
export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  const redirectUri = request.nextUrl.searchParams.get("redirectUri");
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "clientId and redirectUri are required." }, { status: 400 });
  }

  const app = await resolveConnectApp(clientId, redirectUri);
  if (!app) {
    return NextResponse.json(
      { error: "This connection link isn't valid, or this app isn't set up for that redirect." },
      { status: 400 }
    );
  }

  return NextResponse.json({ communityName: app.communityName, communitySlug: app.communitySlug });
}
