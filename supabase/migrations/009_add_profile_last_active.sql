alter table public.profiles
  add column if not exists last_active_at timestamptz default now();

update public.profiles
set last_active_at = coalesce(last_active_at, updated_at, created_at, now())
where last_active_at is null;
