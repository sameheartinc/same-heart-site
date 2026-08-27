import { createClient } from "@supabase/supabase-js";

// Server-only, privileged client -- uses the Supabase SERVICE ROLE key,
// which bypasses Row Level Security entirely. Never import this file
// from a "use client" component; it must only ever run inside a server
// route (like app/api/cron/fetch-news/route.ts), where the key stays on
// the server and is never sent to the browser.
//
// This exists specifically so the hourly news-fetch cron job can write
// into news_articles even though there's deliberately no public "insert"
// policy on that table -- nobody should be able to inject fake headlines
// through the normal API, only this trusted server process.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
