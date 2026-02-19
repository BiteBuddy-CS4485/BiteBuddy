-- Enable realtime for tables that clients subscribe to
alter publication supabase_realtime add table public.session_members;
alter publication supabase_realtime add table public.swipes;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.sessions;
