# Same Heart -- starter

Real accounts now. Sign up, Star Day gets captured once and saved to your
Supabase database, and the Hub reads it back -- persistent across devices,
not just your browser.

## Open this in Cursor

1. Unzip this folder and open it as a project in Cursor (or copy the new/
   changed files into your existing `same-heart-site` clone -- see
   "What's new in this update" below for the exact list).
2. In a terminal inside Cursor: `npm install`
3. `.env.local` in this zip already has your real Supabase URL and anon
   key filled in -- no editing needed to run it locally.
4. `npm run dev` and open http://localhost:3000.

## Two things to check in your Supabase dashboard before testing sign-up

1. **Authentication -> Providers -> Email -> "Confirm email"** -- while
   you're testing, turn this OFF so a new account can sign in immediately
   instead of waiting on a confirmation email. Turn it back ON before
   real people start signing up.
2. **Authentication -> URL Configuration -> Site URL** -- set this to
   `http://localhost:3000` for now; add `https://sameheart.ca` here too
   once you're testing against the live site.

## The flow to test

1. `/` -- the public landing page. Click "Find your frequency."
2. `/login` -- create an account (email + password).
3. `/star-day` -- enter a birth date once. This writes your frequency,
   archetype, and designation into your `profiles` row, permanently.
4. `/hub` -- reads that data back and shows your Day count, Standing, and
   log. Refresh, or open it on a different browser -- it's the same data,
   because it's a real account now, not local storage.

## What's new in this update

- `lib/starDay.ts` -- the frequency/archetype generator, ported exactly
  from the prototype so results match what you already saw.
- `app/login/page.tsx` -- sign up / sign in.
- `app/star-day/page.tsx` -- the birth-date capture, one-time per account.
- `app/hub/page.tsx` -- reads the real profile + log from Supabase.
- `app/page.tsx` -- added a "Find your frequency" link to `/login`.
- `supabase/schema.sql` -- updated to match the schema actually running
  in your Supabase project (profiles + log_entries, Standing/XP fields).
  If you ever change something in the Supabase dashboard directly, update
  this file to match, so it stays a true record of what's live.

## Deploy to Vercel

Same as before, but now it matters: add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` under Project Settings -> Environment
Variables on Vercel too -- `.env.local` only affects your local machine,
not the deployed site. Add both, then redeploy (Deployments tab ->
Redeploy) for the live site to pick them up.

## What's deliberately NOT here yet

- The Heart Chart navigation, the companion, the Signal quote widget,
  ship skins, and Standing tiers are all validated in prototype but not
  wired into these real pages yet -- that's the next pass, once sign-up
  and Star Day are confirmed working end to end. Founding 100, Community
  Ships, merch-unlocked collectibles, and AI Discovery Planets stay
  documented in the Same Heart reference map until their phase comes up.
