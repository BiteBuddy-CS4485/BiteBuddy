-- Trigger function: check if a restaurant is a match after each "like" swipe
-- A match occurs when ALL session members have liked the same restaurant
create or replace function public.check_for_match()
returns trigger as $$
declare
  member_count int;
  like_count int;
  existing_match_id uuid;
begin
  -- Only check on "like" swipes
  if new.liked = false then
    return new;
  end if;

  -- Count total members in the session
  select count(*) into member_count
  from public.session_members
  where session_id = new.session_id;

  -- Count likes for this restaurant in this session
  select count(*) into like_count
  from public.swipes
  where session_id = new.session_id
    and restaurant_id = new.restaurant_id
    and liked = true;

  -- If all members liked it, create a match (if not already matched)
  if like_count >= member_count then
    select id into existing_match_id
    from public.matches
    where session_id = new.session_id
      and restaurant_id = new.restaurant_id;

    if existing_match_id is null then
      insert into public.matches (session_id, restaurant_id)
      values (new.session_id, new.restaurant_id);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_swipe_check_match
  after insert on public.swipes
  for each row execute function public.check_for_match();
