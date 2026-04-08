alter table public.session_members
  add column if not exists invited boolean not null default false;

update public.session_members
set invited = false
where invited is null;
