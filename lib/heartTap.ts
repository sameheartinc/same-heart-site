// Same Heart -- the Galaxy page's secret tap bonus (Sep 9 2026).
//
// Rob's ask, close to verbatim: tap the Same Heart mark on the Galaxy
// page and little hearts fly off every tap (pure client-side flourish
// -- see app/galaxy/page.tsx's heartTaps state, nothing here); tap it
// "a bunch" and it randomly pays out a small amount of XP, once a day,
// with nothing ever announcing the mechanic exists. This file is just
// the client-side call to the one real server route that can move XP
// (app/api/galaxy/heart-tap/route.ts) -- same shape as
// lib/streak.ts's checkInWithServer, which this deliberately mirrors.
//
// The threshold itself lives in app/galaxy/page.tsx (picked fresh,
// randomly, once per page load) rather than here -- this file only
// knows how to ask the server "did that tap count land a bonus,"
// never how many taps it took to get there.

export interface HeartTapResult {
  ok: boolean;
  awarded: boolean; // false = already claimed today (or some other soft no-op) -- not an error
  xp?: number; // the random amount, only set when awarded is true
  newXp?: number;
  newStanding?: string;
}

export async function tapHeartWithServer(accessToken: string): Promise<HeartTapResult | null> {
  try {
    const res = await fetch("/api/galaxy/heart-tap", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as HeartTapResult;
  } catch {
    return null;
  }
}
