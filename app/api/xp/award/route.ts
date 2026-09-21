import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { awardAction } from "@/lib/xpEngine";

// The one door XP walks through for anything configured in
// lib/xpActions.ts. The request says only "I did <action> to <row>" --
// never an amount. lib/xpEngine.ts confirms the row is real, the caller's
// own, and recent, applies the rules (cooldown, daily allowance, quality,
// diminishing returns, Boost), and pays out at most once per row. Best-
// effort by design for callers: a "no" here (reason set, awarded 0) is a
// normal answer, never an error to show anyone.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Your session's expired -- sign in again." }, { status: 401 });
  }

  let action: string;
  let targetId: string;
  try {
    const body = await request.json();
    action = String(body.action ?? "");
    targetId = String(body.targetId ?? "");
  } catch {
    return NextResponse.json({ error: "Couldn't read that request." }, { status: 400 });
  }
  if (!action || !targetId) {
    return NextResponse.json({ error: "Missing action or target." }, { status: 400 });
  }

  const result = await awardAction(admin, userData.user.id, action, targetId);
  return NextResponse.json(result);
}
