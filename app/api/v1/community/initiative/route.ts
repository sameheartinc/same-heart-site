import { NextRequest, NextResponse } from "next/server";
import { getApiKeyContext } from "@/lib/communityApi";
import { computeInitiativeSignals } from "@/lib/initiative";

// The API door onto the same "who's stepping up" signal as
// app/api/commons/initiative -- see lib/initiative.ts. This is the
// literal promise in the Ignition memo made real for a business running
// its own community through the white-label API: "Same Heart doesn't
// just host your community. It finds your next moderator before you'd
// have noticed them yourself" isn't worth much if it only ever shows up
// inside sameheart.ca's own UI.
export async function GET(request: NextRequest) {
  const ctx = await getApiKeyContext(request);
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });

  const signals = await computeInitiativeSignals(ctx.communityId);
  return NextResponse.json({ signals });
}
