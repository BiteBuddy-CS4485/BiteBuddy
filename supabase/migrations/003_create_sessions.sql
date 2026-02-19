create table public.sessions (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed')),
  latitude float8 not null,
  longitude float8 not null,
  radius_meters int not null default 5000,
  price_filter text[],
  category_filter text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

create table public.session_members (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now() not null,
  unique (session_id, user_id)
);

alter table public.sessions enable row level security;
alter table public.session_members enable row level security;

-- Session is viewable by its members or creator
create policy "Session members can view session"
  on public.sessions for select
  to authenticated
  using (
    id in (select session_id from public.session_members where user_id = auth.uid())
    or created_by = auth.uid()
  );

create policy "Creator can update session"
  on public.sessions for update
  to authenticated
  using (created_by = auth.uid());

create policy "Authenticated users can create sessions"
  on public.sessions for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Members can view other members in their sessions
create policy "Members can view session members"
  on public.session_members for select
  to authenticated
  using (
    session_id in (select session_id from public.session_members where user_id = auth.uid())
  );

create policy "Users can join sessions"
  on public.session_members for insert
  to authenticated
  with check (auth.uid() = user_id);
