-- Security-definer function: lets authenticated users look up a session by invite code
-- without needing the service-role key. Bypasses RLS safely because it only exposes
-- sessions the caller already knows the invite code for.
create or replace function public.get_session_by_invite_code(p_code text)
returns table(id uuid, name text, status text)
language sql
security definer
set search_path = public
as $$
  select id, name, status
  from public.sessions
  where invite_code = upper(trim(p_code));
$$;

grant execute on function public.get_session_by_invite_code(text) to authenticated;

-- Allow users to remove themselves from sessions (needed for Leave Session)
create policy "Users can leave sessions"
  on public.session_members for delete
  to authenticated
  using (auth.uid() = user_id);
