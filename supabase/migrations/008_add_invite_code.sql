-- Add invite_code to sessions for shareable invite links
alter table public.sessions add column invite_code text unique;

-- Generate codes for any existing sessions
create or replace function generate_invite_code() returns text as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * 36 + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

update public.sessions set invite_code = generate_invite_code() where invite_code is null;
