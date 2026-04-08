-- Security-definer function so any session member can atomically write
-- their own location slot in sessions.user_locations without needing
-- UPDATE permission on the sessions table (which is creator-only via RLS).
create or replace function public.store_user_location(
  p_session_id uuid,
  p_lat        float8,
  p_lng        float8
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Caller must be a member of the session
  if not exists (
    select 1 from session_members
    where session_id = p_session_id
      and user_id    = auth.uid()
  ) then
    raise exception 'Not a member of this session';
  end if;

  -- Atomic jsonb_set — no read-modify-write race condition
  update sessions
  set
    user_locations = jsonb_set(
      coalesce(user_locations, '{}'),
      array[auth.uid()::text],
      jsonb_build_object(
        'lat',       p_lat,
        'lng',       p_lng,
        'timestamp', now()::text
      )
    ),
    updated_at = now()
  where id = p_session_id;
end;
$$;
