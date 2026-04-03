import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Image,
  Dimensions, FlatList,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { shadow } from '../../lib/shadows';
import type { Session, FriendWithProfile, SessionDetails } from '@bitebuddy/shared';
import type { JoinByCodeResponse } from '@bitebuddy/shared';

type RecentMatch = {
  sessionId: string;
  sessionName: string;
  restaurantName: string;
  memberCount: number;
  date: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Join by code
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  // Realtime: listen for session invites targeting this user
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel('home-invites')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_members',
        filter: `user_id=eq.${profile.id}`,
      }, () => {
        loadSessions();
        Alert.alert('New Session Invite', "You've been invited to a session!");
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function loadAll() {
    await Promise.all([loadSessions(), loadFriends(), loadRecentMatches()]);
  }

  async function loadSessions() {
    try {
      setSessionsLoading(true);
      const data = await apiGet<Session[]>('/api/sessions');
      setSessions(data);
    } catch {
      // silently fail
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadFriends() {
    try {
      const data = await apiGet<FriendWithProfile[]>('/api/friends');
      setFriends(data ?? []);
    } catch {
      // silently fail
    }
  }

  async function loadRecentMatches() {
    try {
      setMatchesLoading(true);
      const completed = await apiGet<Session[]>('/api/sessions?status=completed');
      const recent = completed.slice(0, 4);
      const matches: RecentMatch[] = [];
      await Promise.all(
        recent.map(async (session) => {
          try {
            const details = await apiGet<SessionDetails>(`/api/sessions/${session.id}`);
            if (details.match_count > 0) {
              // Try to get the first matched restaurant name
              try {
                const results = await apiGet<{ matches: Array<{ restaurant: { name: string } }> }>(
                  `/api/sessions/${session.id}/results`
                );
                const firstName = results.matches?.[0]?.restaurant?.name ?? session.name;
                matches.push({
                  sessionId: session.id,
                  sessionName: session.name,
                  restaurantName: firstName,
                  memberCount: details.members?.length ?? 0,
                  date: session.created_at,
                });
              } catch {
                matches.push({
                  sessionId: session.id,
                  sessionName: session.name,
                  restaurantName: session.name,
                  memberCount: details.members?.length ?? 0,
                  date: session.created_at,
                });
              }
            }
          } catch {
            // skip
          }
        })
      );
      setRecentMatches(matches.slice(0, 3));
    } catch {
      setRecentMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function handleJoinByCode() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('Please enter a 6-character invite code.');
      return;
    }
    setJoinError('');
    setJoining(true);
    try {
      const result = await apiPost<JoinByCodeResponse>('/api/sessions/join-by-code', { code });
      setJoinModalVisible(false);
      setJoinCode('');
      if (result.status === 'waiting') {
        router.push(`/session/${result.session_id}/lobby`);
      } else if (result.status === 'active') {
        router.push(`/session/${result.session_id}/swipe`);
      } else {
        Alert.alert('Session Ended', 'This session has already completed.');
      }
    } catch (err: any) {
      setJoinError(err.message ?? 'Invalid invite code');
    } finally {
      setJoining(false);
    }
  }

  function handleSessionPress(session: Session) {
    if (session.status === 'waiting') {
      router.push(`/session/${session.id}/lobby`);
    } else if (session.status === 'active') {
      router.push(`/session/${session.id}/swipe`);
    } else {
      router.push(`/session/${session.id}/results`);
    }
  }

  function formatRelativeDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `Last ${days[date.getDay()]}`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const activeSessions = sessions.filter(s =>
    s.status !== 'completed' &&
    s.status !== 'cancelled' &&
    Date.now() - new Date(s.created_at).getTime() < TWENTY_FOUR_HOURS
  );

  const displayName = profile?.display_name ?? profile?.username ?? 'there';
  const CARD_WIDTH = SCREEN_WIDTH - 48;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>BiteBuddy</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.7}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>Hey, {displayName} !</Text>
          <Text style={styles.greetingSubtitle}>Ready to find where to eat tonight?</Text>
        </View>

        {/* Friends Row */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FRIENDS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.friendsRow}
          >
            {/* Add Friends button */}
            <TouchableOpacity
              style={styles.inviteAvatar}
              onPress={() => router.push('/(tabs)/friends')}
              activeOpacity={0.7}
            >
              <Text style={styles.inviteAvatarIcon}>+</Text>
              <Text style={styles.avatarLabel}>Friends</Text>
            </TouchableOpacity>

            {/* Friend avatars */}
            {friends.slice(0, 8).map((f) => {
              const initial = (f.profile.display_name ?? f.profile.username ?? '?').charAt(0).toUpperCase();
              return (
                <View key={f.id} style={styles.friendAvatarWrap}>
                  {f.profile.avatar_url ? (
                    <Image source={{ uri: f.profile.avatar_url }} style={styles.friendAvatarImg} />
                  ) : (
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>{initial}</Text>
                    </View>
                  )}
                  <View style={styles.onlineDot} />
                  <Text style={styles.avatarLabel} numberOfLines={1}>
                    {f.profile.display_name?.split(' ')[0] ?? f.profile.username}
                  </Text>
                </View>
              );
            })}

            {friends.length === 0 && (
              <Text style={styles.noFriendsText}>Add friends to see them here</Text>
            )}
          </ScrollView>
        </View>

        {/* Active Sessions */}
        {sessionsLoading ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACTIVE SESSION</Text>
            <ActivityIndicator color="#FF6B35" style={{ paddingVertical: 16 }} />
          </View>
        ) : activeSessions.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {activeSessions.length === 1 ? 'ACTIVE SESSION' : `ACTIVE SESSIONS (${activeSessions.length})`}
            </Text>
            <FlatList
              data={activeSessions}
              keyExtractor={s => s.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 12}
              decelerationRate="fast"
              contentContainerStyle={styles.activeSessionsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.activeSessionCard, { width: CARD_WIDTH }]}
                  onPress={() => handleSessionPress(item)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.activeSessionName}>{item.name}</Text>
                  <View style={styles.activeSessionMeta}>
                    <View style={styles.liveChip}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>
                        {item.status === 'active' ? 'Live' : 'Waiting'}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.joinChip} onPress={() => handleSessionPress(item)}>
                      <Text style={styles.joinChipText}>
                        {item.status === 'active' ? 'Continue →' : 'Join →'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : null}

        {/* Start New Session */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/session/create')}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionIcon}>🍽</Text>
              <Text style={styles.quickActionTitle}>New Session</Text>
              <Text style={styles.quickActionSub}>Start swiping</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => setJoinModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickActionIcon}>🔗</Text>
              <Text style={styles.quickActionTitle}>Join by Code</Text>
              <Text style={styles.quickActionSub}>Enter invite code</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Matches */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECENT MATCHES</Text>
          {matchesLoading ? (
            <ActivityIndicator color="#FF6B35" style={{ paddingVertical: 16 }} />
          ) : recentMatches.length === 0 ? (
            <View style={styles.noMatchesBox}>
              <Text style={styles.noMatchesText}>
                No matches yet — start swiping with friends!
              </Text>
            </View>
          ) : (
            recentMatches.map((m) => (
              <TouchableOpacity
                key={m.sessionId}
                style={styles.matchCard}
                onPress={() => router.push(`/session/${m.sessionId}/results`)}
                activeOpacity={0.7}
              >
                <View style={styles.matchIcon}>
                  <Text style={styles.matchIconText}>🍽</Text>
                </View>
                <View style={styles.matchInfo}>
                  <Text style={styles.matchName} numberOfLines={1}>{m.restaurantName}</Text>
                  <Text style={styles.matchMeta}>
                    {formatRelativeDate(m.date)}
                    {m.memberCount > 0 ? ` · ${m.memberCount} people` : ''}
                  </Text>
                </View>
                <Text style={styles.matchChevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Join by Code Modal */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setJoinModalVisible(false); setJoinCode(''); setJoinError(''); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join a Session</Text>
            <Text style={styles.modalSubtitle}>Enter the 6-character invite code</Text>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={t => { setJoinCode(t.toUpperCase()); setJoinError(''); }}
              placeholder="ABC123"
              placeholderTextColor="#bbb"
              autoCapitalize="characters"
              maxLength={6}
              autoFocus
            />
            {joinError ? <Text style={styles.joinErrorText}>{joinError}</Text> : null}
            <TouchableOpacity
              style={[styles.joinButton, joining && styles.joinButtonDisabled]}
              onPress={handleJoinByCode}
              disabled={joining}
            >
              {joining ? <ActivityIndicator color="#fff" /> : <Text style={styles.joinButtonText}>Join Session</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setJoinModalVisible(false); setJoinCode(''); setJoinError(''); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  greeting: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  greetingSubtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  friendsRow: {
    paddingHorizontal: 16,
    gap: 16,
    alignItems: 'flex-start',
  },
  inviteAvatar: {
    alignItems: 'center',
    width: 56,
  },
  inviteAvatarIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
    textAlign: 'center',
    lineHeight: 44,
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: '300',
    overflow: 'hidden',
  },
  friendAvatarWrap: {
    alignItems: 'center',
    width: 56,
    position: 'relative',
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#607D8B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  friendAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 18,
    right: 3,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 56,
  },
  noFriendsText: {
    fontSize: 13,
    color: '#aaa',
    paddingVertical: 12,
    alignSelf: 'center',
  },
  activeSessionsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  activeSessionCard: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    padding: 20,
    ...shadow(0, 4, 12, 0.2),
  },
  activeSessionName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  activeSessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  joinChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  joinChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickActionsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    gap: 4,
  },
  quickActionIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  quickActionSub: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  noMatchesBox: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  noMatchesText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  matchCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  matchIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#607D8B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  matchIconText: {
    fontSize: 24,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  matchMeta: {
    fontSize: 13,
    color: '#888',
  },
  matchChevron: {
    fontSize: 22,
    color: '#ccc',
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  codeInput: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  joinErrorText: {
    color: '#e53935',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
    width: '100%',
  },
  joinButton: {
    width: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelText: {
    color: '#888',
    fontSize: 15,
    paddingVertical: 4,
  },
});
