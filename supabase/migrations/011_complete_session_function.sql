-- Security-definer function: checks whether all members have swiped all restaurants
-- for a session and, if so, marks it completed. Called after every swipe so the
-- session auto-completes without needing the service-role key.
create or replace function public.maybe_complete_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_swipes  bigint;
  v_member_count  bigint;
  v_restaurant_count bigint;
begin
  select count(*) into v_total_swipes
    from public.swipes
    where session_id = p_session_id;

  select count(*) into v_member_count
    from public.session_members
    where session_id = p_session_id;

  select count(*) into v_restaurant_count
    from public.session_restaurants
    where session_id = p_session_id;

  if v_restaurant_count > 0 and v_total_swipes >= v_member_count * v_restaurant_count then
    update public.sessions
      set status = 'completed'
      where id = p_session_id
        and status not in ('completed', 'cancelled');
  end if;
end;
$$;

grant execute on function public.maybe_complete_session(uuid) to authenticated;
