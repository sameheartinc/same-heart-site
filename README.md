# Same Heart -- starter

This is the Phase 1 "public foundation" scaffold: a working Next.js site,
pre-wired for Supabase (accounts + per-user data) and ready for the Claude
API to be added for the Universe features later.

## Open this in Cursor

1. Unzip this folder and open it as a project in Cursor.
2. In a terminal inside Cursor: `npm install`
3. `cp .env.example .env.local` and leave it empty for now -- the landing
   page runs fine without Supabase configured yet.
4. `npm run dev` and open http://localhost:3000 -- you should see the
   "Something is arriving" landing page in the brand colors.

## Connect Supabase (when you're ready for accounts)

1. Create a free project at supabase.com.
2. In the Supabase dashboard: SQL Editor -> New query -> paste the
   contents of `supabase/schema.sql` -> Run. This creates the `profiles`
   table (progress, preferences, ship state) with row-level security, so
   each person can only ever see their own data.
3. Project Settings -> API -> copy the Project URL and anon public key
   into `.env.local`.
4. `lib/supabaseClient.ts` is already set up to read those values.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. At vercel.com: New Project -> import that repo -> it will
   auto-detect Next.js.
3. Add the same two `NEXT_PUBLIC_SUPABASE_*` variables (and later
   `ANTHROPIC_API_KEY`) under Project Settings -> Environment Variables.
4. Deploy. Point sameheart.com / sameheart.ca at the Vercel project once
   the domain is registered (Vercel -> Settings -> Domains).

## What's deliberately NOT here yet

- No sign-in UI, no Claude API call, no community channels, no
  Observatory/Gazing Eye. Those are Phase 2-3 -- see the roadmap in the
  Same Heart reference map. Building them now, before the foundation is
  live, is how projects stall. Get this landing page deployed and the
  domain pointed at it first.
