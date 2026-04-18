-- Performance indexes for hot read paths

-- Supports check_for_match() trigger: counts liked swipes per (session, restaurant).
-- Partial index on liked = true since the trigger only counts likes.
create index if not exists swipes_match_check_idx
  on public.swipes (session_id, restaurant_id)
  where liked = true;

-- Supports RLS subqueries of the form:
--   session_id in (select session_id from session_members where user_id = auth.uid())
-- Used by policies on sessions, session_restaurants, swipes, matches, session_members.
-- The existing unique (session_id, user_id) index leads with session_id, so lookups
-- by user_id alone cannot use it.
create index if not exists session_members_user_id_idx
  on public.session_members (user_id);
