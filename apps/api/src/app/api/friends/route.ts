import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      *,
      requester:profiles!requester_id(*),
      addressee:profiles!addressee_id(*)
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const friends = data?.map(f => ({
    ...f,
    profile: f.requester_id === user.id ? f.addressee : f.requester,
  })) ?? [];

  const friendIds = friends.map((friend) => friend.profile.id);
  const activeSessionByUserId = new Map<string, { id: string; name: string }>();

  if (friendIds.length > 0) {
    const { data: activeSessions } = await supabase
      .from('sessions')
      .select('id, name, status')
      .in('status', ['waiting', 'active']);

    const activeSessionIds = (activeSessions ?? []).map((session) => session.id);

    if (activeSessionIds.length > 0) {
      const { data: activeMemberships } = await supabase
        .from('session_members')
        .select('session_id, user_id')
        .in('session_id', activeSessionIds)
        .in('user_id', friendIds);

      const sessionLookup = new Map((activeSessions ?? []).map((session) => [session.id, session]));
      (activeMemberships ?? []).forEach((membership) => {
        if (activeSessionByUserId.has(membership.user_id)) return;
        const session = sessionLookup.get(membership.session_id);
        if (session) {
          activeSessionByUserId.set(membership.user_id, { id: session.id, name: session.name });
        }
      });
    }
  }

  const now = Date.now();
  const enrichedFriends = friends.map((friend) => {
    const lastActiveAt = friend.profile.last_active_at ? new Date(friend.profile.last_active_at).getTime() : 0;
    const online = lastActiveAt > 0 && now - lastActiveAt < 5 * 60 * 1000;
    const activeSession = activeSessionByUserId.get(friend.profile.id);

    return {
      ...friend,
      online,
      active_session_id: activeSession?.id ?? null,
      active_session_name: activeSession?.name ?? null,
    };
  });

  return NextResponse.json({ data: enrichedFriends });
}
