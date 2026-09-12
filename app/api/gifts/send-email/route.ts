import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "../../../../lib/apiAuth";
import { supabaseAdmin } from "../../../../lib/supabaseServer";
import { sendGiftEmail } from "../../../../lib/emailServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authed = await getAuthedUser(req);
  if (!authed || !supabaseAdmin) {
    return NextResponse.json({ error: "must be signed in" }, { status: 401 });
  }

  let body: { code?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { code, email } = body;
  if (!code || !email) {
    return NextResponse.json({ error: "code and email are required" }, { status: 400 });
  }

  const { data: giftRow, error: giftError } = await supabaseAdmin
    .from("gift_codes")
    .select("reward_key, created_by, redeemed_by")
    .eq("code", code)
    .maybeSingle();
  if (giftError || !giftRow || giftRow.created_by !== authed.user.id) {
    return NextResponse.json({ error: "gift code not found or not yours" }, { status: 404 });
  }
  if (giftRow.redeemed_by) {
    return NextResponse.json({ error: "this gift has already been redeemed" }, { status: 409 });
  }

  const { data: rewardRow } = await supabaseAdmin
    .from("rewards_catalog")
    .select("title, description")
    .eq("key", giftRow.reward_key)
    .maybeSingle();

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  try {
    await sendGiftEmail({
      to: email,
      rewardTitle: rewardRow?.title ?? "A gift",
      rewardDescription: rewardRow?.description ?? "",
      code,
      claimUrl: `${origin}/claim/${code}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to send email";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await supabaseAdmin.from("gift_codes").update({ recipient_email: email }).eq("code", code);

  return NextResponse.json({ sent: true });
}
