-- Add 'cancelled' as a valid session status
alter table public.sessions drop constraint sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('waiting', 'active', 'completed', 'cancelled'));
