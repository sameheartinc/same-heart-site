-- Sponsorship campaigns (Sep 22, 2026) -- businesses sponsoring a Same
-- Heart initiative (starting with a winter "Socks & Warmth" drive) in
-- exchange for real visibility, NOT a charitable tax receipt -- Same
-- Heart Inc. is a regular corporation, not a registered charity, so this
-- is a plain marketing/sponsorship arrangement (the sponsor's own
-- accountant treats it as an advertising expense). Deliberately a
-- separate, generically-named set of tables from the unrelated
-- `campaigns` table above (AI-suggested personal Path campaigns) --
-- these have nothing to do with each other beyond sharing the word
-- "campaign" in English.
--
-- Public read on campaigns/tiers (anyone should see what's being
-- sponsored and for how much before paying) and on sponsorships (a
-- sponsor wall is the whole point of paying), but real money changing
-- hands is verified server-side only: a sponsorship starts as a
-- 'pending' row the moment someone begins checkout (see
-- app/api/sponsor/checkout/route.ts), and only ever flips to 'paid' by
-- app/api/sponsor/webhook/route.ts after Stripe itself confirms the
-- charge -- nobody can mark their own sponsorship paid by editing a
-- client request. No update/delete policy for anyone at all.
create table if not exists sponsor_campaigns (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  title text not null,
  description text not null,
  goal_cents integer not null default 0,
  hero_image_url text,
  status text not null default 'active' check (status in ('draft', 'active', 'completed')),
  starts_at timestamptz default now(),
  ends_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists sponsor_tiers (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references sponsor_campaigns(id) on delete cascade,
  name text not null,
  price_cents integer not null,
  perks text[] not null default '{}',
  sort_order integer not null default 0,
  unique (campaign_id, name)
);

create table if not exists sponsorships (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references sponsor_campaigns(id) on delete cascade,
  tier_id uuid references sponsor_tiers(id) on delete set null,
  business_name text not null,
  website text,
  contact_email text not null,
  logo_url text,
  amount_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  stripe_checkout_session_id text unique,
  created_at timestamptz default now(),
  paid_at timestamptz
);

alter table sponsor_campaigns enable row level security;
alter table sponsor_tiers enable row level security;
alter table sponsorships enable row level security;

drop policy if exists "Anyone sees active campaigns" on sponsor_campaigns;
create policy "Anyone sees active campaigns" on sponsor_campaigns for select using (status != 'draft');

drop policy if exists "Anyone sees tiers of a visible campaign" on sponsor_tiers;
create policy "Anyone sees tiers of a visible campaign" on sponsor_tiers for select using (
  exists (select 1 from sponsor_campaigns c where c.id = sponsor_tiers.campaign_id and c.status != 'draft')
);

-- Contact email is the one field on a sponsorship that isn't meant for
-- public display (a sponsor wall shows business_name/logo_url, never an
-- inbox) -- narrowed the same way get_public_profiles narrows profiles,
-- rather than trusting every future caller to remember to select around
-- it.
create or replace view public_sponsorships as
  select id, campaign_id, tier_id, business_name, website, logo_url, amount_cents, status, paid_at
  from sponsorships
  where status = 'paid';

grant select on public_sponsorships to anon, authenticated;

notify pgrst, 'reload schema';

-- Sponsor logos -- public bucket, but no client insert policy at all:
-- the only writer is the service-role client inside
-- app/api/sponsor/checkout/route.ts, which uploads the file server-side
-- as part of creating a pending sponsorship. Sponsors aren't Same Heart
-- accounts (this is a public business form, no sign-in), so the
-- folder-per-uid pattern the other buckets use doesn't apply here -- the
-- server is the only thing that ever writes to this bucket, period.
insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view sponsor logos" on storage.objects;
create policy "Anyone can view sponsor logos" on storage.objects for select
  using (bucket_id = 'sponsor-logos');

notify pgrst, 'reload schema';

-- The first sponsorship campaign: Socks & Warmth, a winter drive.
-- Copy/goal/tier perks here are a first draft, easy to edit later --
-- this is just data (see sponsor_campaigns/sponsor_tiers above), not a
-- code change. Safe to run more than once.
insert into sponsor_campaigns (slug, title, description, goal_cents, status)
values (
  'socks-and-warmth',
  'Socks & Warmth',
  'Every winter, real people across Canada go without the basics -- warm socks, a blanket, something to light a cold room. This campaign turns business sponsorship directly into real supplies, delivered before the cold sets in. Sponsors are recognized publicly on this page; nothing here is a charitable tax receipt -- Same Heart Inc. is a company, not a registered charity, and this is a sponsorship, not a donation.',
  1000000,
  'active'
)
on conflict (slug) do nothing;

insert into sponsor_tiers (campaign_id, name, price_cents, perks, sort_order)
select id, 'Bronze', 25000, array['Your business name listed on this campaign page'], 1
from sponsor_campaigns where slug = 'socks-and-warmth'
on conflict (campaign_id, name) do nothing;

insert into sponsor_tiers (campaign_id, name, price_cents, perks, sort_order)
select id, 'Silver', 75000, array['Your name and logo on this campaign page', 'One dedicated mention on Same Heart''s social channels'], 2
from sponsor_campaigns where slug = 'socks-and-warmth'
on conflict (campaign_id, name) do nothing;

insert into sponsor_tiers (campaign_id, name, price_cents, perks, sort_order)
select id, 'Gold', 200000, array['A larger logo placement on this campaign page', '"Presented by" credit on the campaign', 'A dedicated social media post about your sponsorship'], 3
from sponsor_campaigns where slug = 'socks-and-warmth'
on conflict (campaign_id, name) do nothing;

notify pgrst, 'reload schema';
