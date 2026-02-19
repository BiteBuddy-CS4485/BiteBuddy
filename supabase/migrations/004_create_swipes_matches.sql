create table public.session_restaurants (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  yelp_id text not null,
  name text not null,
  image_url text,
  rating float4,
  review_count int,
  price text,
  categories jsonb,
  address text,
  latitude float8,
  longitude float8,
  phone text,
  yelp_url text
);

create table public.swipes (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.session_restaurants(id) on delete cascade,
  liked boolean not null,
  created_at timestamptz default now() not null,
  unique (session_id, user_id, restaurant_id)
);

create table public.matches (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  restaurant_id uuid not null references public.session_restaurants(id) on delete cascade,
  matched_at timestamptz default now() not null
);

alter table public.session_restaurants enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;

-- Session members can view restaurants in their session
create policy "Members can view session restaurants"
  on public.session_restaurants for select
  to authenticated
  using (
    session_id in (select session_id from public.session_members where user_id = auth.uid())
  );

-- Session creator can insert restaurants (called by API during session start)
create policy "Creator can insert restaurants"
  on public.session_restaurants for insert
  to authenticated
  with check (
    session_id in (select id from public.sessions where created_by = auth.uid())
  );

-- Members can insert swipes
create policy "Members can insert swipes"
  on public.swipes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and session_id in (select session_id from public.session_members where user_id = auth.uid())
  );

-- Members can view swipes in their session
create policy "Members can view swipes"
  on public.swipes for select
  to authenticated
  using (
    session_id in (select session_id from public.session_members where user_id = auth.uid())
  );

-- Members can view matches
create policy "Members can view matches"
  on public.matches for select
  to authenticated
  using (
    session_id in (select session_id from public.session_members where user_id = auth.uid())
  );

-- Matches are inserted by the trigger function (security definer)
create policy "Trigger can insert matches"
  on public.matches for insert
  to authenticated
  with check (
    session_id in (select session_id from public.session_members where user_id = auth.uid())
  );
