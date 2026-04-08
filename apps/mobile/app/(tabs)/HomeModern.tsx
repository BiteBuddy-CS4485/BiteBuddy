import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function HomeModern() {
  const router = useRouter();
  const { profile } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void loadFriends();
      void loadSessions();
      void loadRecentMatches();
    }, [])
  );

  async function loadFriends() {
    try {
      setFriendsLoading(true);
      const data = await apiGet<any>('/api/friends');
      if (Array.isArray(data)) setFriends(data);
      else if (Array.isArray(data?.data)) setFriends(data.data);
      else setFriends([]);
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }

  async function loadSessions() {
    try {
      setSessionsLoading(true);
      const data = await apiGet<any>('/api/sessions');
      if (Array.isArray(data)) setSessions(data);
      else if (Array.isArray(data?.data)) setSessions(data.data);
      else setSessions([]);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadRecentMatches() {
    try {
      setMatchesLoading(true);
      const data = await apiGet<any>('/api/sessions/recent-matches?limit=10');
      setRecentMatches(Array.isArray(data) ? data : (data?.matches || []));
    } catch {
      setRecentMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }

  const displayName = profile?.display_name ?? profile?.username ?? 'there';
  const activeSession = useMemo(
    () =>
      sessions.find(
        (session: any) =>
          session.status !== 'completed' &&
          !(session.status === 'active' && session.is_current_user_done)
      ) ?? null,
    [sessions]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>BiteBuddy</Text>
        <TouchableOpacity style={styles.iconCircle} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="settings-outline" size={25} color="#ff6f70" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heroTitle}>Hey, {displayName} !</Text>
        <Text style={styles.heroSubtitle}>Ready to find where to eat tonight?</Text>

        <Text style={styles.sectionLabel}>FRIENDS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsRow}>
          <TouchableOpacity style={styles.addFriendCircle} onPress={() => router.push('/(tabs)/friends')}>
            <Ionicons name="add" size={34} color="#ff6f70" />
          </TouchableOpacity>

          {friendsLoading ? (
            <ActivityIndicator color="#ff6f70" style={{ marginLeft: 8 }} />
          ) : friends.length === 0 ? (
            <Text style={styles.emptyInline}>No friends yet</Text>
          ) : (
            friends.slice(0, 4).map((friend) => {
              const name = friend.profile.display_name || friend.profile.username || '?';
              const online = friend.online || !!friend.active_session_id;
              return (
                <View key={friend.id} style={styles.friendAvatarWrap}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendInitial}>{name.charAt(0).toUpperCase()}</Text>
                    <View style={[styles.friendDot, !online && styles.friendDotOffline]} />
                  </View>
                  <Text style={styles.friendName} numberOfLines={1}>{name}</Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <Text style={styles.sectionLabel}>ACTIVE SESSION</Text>
        <View style={styles.sectionBlock}>
          {sessionsLoading ? (
            <ActivityIndicator color="#ff6f70" />
          ) : !activeSession ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardTitle}>No Active Session</Text>
              <Text style={styles.emptyCardText}>Create a session to start swiping.</Text>
            </View>
          ) : (
            <View style={styles.activeCard}>
              <View>
                <Text style={styles.activeTitle}>{activeSession.name || 'Session'}</Text>
                <Text style={styles.activeMeta}>
                  {(activeSession.member_count || activeSession.participants?.length || 1)} participants · Live now
                </Text>
              </View>
              <View style={styles.activeFooter}>
                <View style={styles.liveChip}>
                  <Text style={styles.liveChipText}>Live</Text>
                </View>
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={() => router.push(`/session/${activeSession.id}/lobby`)}
                >
                  <Text style={styles.joinButtonText}>Join →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>START NEW SESSION</Text>
        <TouchableOpacity style={styles.newSessionCard} onPress={() => router.push('/session/create')}>
          <Text style={styles.newSessionTitle}>New Session</Text>
          <Text style={styles.newSessionText}>Invite friends - set radius - start swiping</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>RECENT MATCHES</Text>
        <View style={styles.sectionBlock}>
          {matchesLoading ? (
            <ActivityIndicator color="#ff6f70" />
          ) : recentMatches.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardTitle}>No recent matches</Text>
            </View>
          ) : (
            recentMatches.slice(0, 2).map((match: any) => (
              <TouchableOpacity
                key={match.match_id}
                style={styles.matchRow}
                onPress={() => router.push('/(tabs)/history')}
              >
                <View style={styles.matchThumbWrap}>
                  {match.restaurant_image_url ? (
                    <Image source={{ uri: match.restaurant_image_url }} style={styles.matchThumb} />
                  ) : (
                    <View style={[styles.matchThumb, styles.matchThumbPlaceholder]}>
                      <Text style={styles.matchThumbEmoji}>🍜</Text>
                    </View>
                  )}
                </View>
                <View style={styles.matchMeta}>
                  <Text style={styles.matchTitle}>{match.restaurant_name || 'Restaurant'}</Text>
                  <Text style={styles.matchSubtitle}>Recent match</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#9aa4af" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    height: 94,
    backgroundColor: '#f8fafb',
    borderBottomColor: '#e9edf1',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flex: 1,
    textAlign: 'center',
    marginLeft: 38,
    color: '#101828',
    fontSize: 22,
    fontWeight: '800',
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe9ea',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 34,
  },
  heroTitle: {
    color: '#101828',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 6,
    color: '#475467',
    fontSize: 21,
    lineHeight: 28,
  },
  sectionLabel: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
    letterSpacing: 0.9,
  },
  sectionBlock: {
    minHeight: 24,
  },
  friendsRow: {
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 8,
  },
  addFriendCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    borderColor: '#ff6f70',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  friendAvatarWrap: {
    alignItems: 'center',
    width: 72,
  },
  friendAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#6b7788',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  friendInitial: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  friendDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#10b954',
  },
  friendDotOffline: {
    backgroundColor: '#98a2b3',
  },
  friendName: {
    color: '#475467',
    fontSize: 13,
  },
  emptyInline: {
    marginTop: 22,
    color: '#667085',
    fontSize: 15,
  },
  activeCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#ff7b67',
    shadowColor: '#7d4b3b',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 9 },
    shadowRadius: 12,
    elevation: 5,
  },
  activeTitle: {
    color: '#fff',
    fontSize: 31,
    lineHeight: 34,
    fontWeight: '800',
  },
  activeMeta: {
    marginTop: 6,
    color: '#ffe8e2',
    fontSize: 19,
    lineHeight: 24,
  },
  activeFooter: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveChip: {
    borderRadius: 18,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  liveChipText: {
    color: '#344054',
    fontWeight: '700',
    fontSize: 16,
  },
  joinButton: {
    borderRadius: 18,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  joinButtonText: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 16,
  },
  newSessionCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#c8cfd8',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  newSessionTitle: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 23,
  },
  newSessionText: {
    marginTop: 6,
    color: '#667085',
    fontSize: 19,
    lineHeight: 24,
  },
  matchRow: {
    borderRadius: 18,
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#6b7788',
  },
  matchThumb: {
    width: '100%',
    height: '100%',
  },
  matchThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchThumbEmoji: {
    fontSize: 28,
  },
  matchMeta: {
    flex: 1,
  },
  matchTitle: {
    color: '#101828',
    fontSize: 20,
    fontWeight: '700',
  },
  matchSubtitle: {
    marginTop: 2,
    color: '#667085',
    fontSize: 17,
  },
  emptyCard: {
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  emptyCardTitle: {
    color: '#344054',
    fontWeight: '700',
    fontSize: 18,
  },
  emptyCardText: {
    marginTop: 4,
    color: '#667085',
    fontSize: 14,
  },
});
