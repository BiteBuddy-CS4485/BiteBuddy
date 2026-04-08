import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../lib/api';
import type { RecentMatchDTO, Session } from '@bitebuddy/shared';

type Filter = 'all' | 'match' | 'no-match';
type HistorySession = Session & { member_count?: number; match_count?: number };

export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatchDTO[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [])
  );

  async function loadHistory() {
    try {
      const [sessionData, friendsData, recentMatchData] = await Promise.all([
        apiGet<HistorySession[]>('/api/sessions?status=completed'),
        apiGet<any[]>('/api/friends'),
        apiGet<{ matches: RecentMatchDTO[] }>('/api/sessions/recent-matches?limit=8'),
      ]);
      setSessions(sessionData);
      setFriendsCount(Array.isArray(friendsData) ? friendsData.length : 0);
      setRecentMatches(recentMatchData.matches ?? []);
    } catch {
      setSessions([]);
      setRecentMatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const totalMatches = useMemo(
    () => sessions.reduce((sum, session) => sum + (session.match_count ?? 0), 0),
    [sessions]
  );

  const filtered = useMemo(() => {
    if (filter === 'match') return sessions.filter((session) => (session.match_count ?? 0) > 0);
    if (filter === 'no-match') return sessions.filter((session) => (session.match_count ?? 0) === 0);
    return sessions;
  }, [sessions, filter]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#ff6f70" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="menu-outline" size={24} color="#ff6f70" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadHistory();
            }}
            tintColor="#ff6f70"
          />
        }
      >
        <View style={styles.statsCard}>
          <StatCol label="Sessions" value={sessions.length} />
          <StatCol label="Matches" value={totalMatches} />
          <StatCol label="Friends" value={friendsCount} />
        </View>

        <View style={styles.segmentWrap}>
          <Segment label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Segment label="Matches" active={filter === 'match'} onPress={() => setFilter('match')} />
          <Segment label="No Match" active={filter === 'no-match'} onPress={() => setFilter('no-match')} />
        </View>

        <Text style={styles.sectionLabel}>RECENT MATCHES</Text>
        {recentMatches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No recent matches yet</Text>
          </View>
        ) : (
          recentMatches.slice(0, 3).map((match) => (
            <TouchableOpacity
              key={match.match_id}
              style={styles.recentMatchCard}
              onPress={() => router.push(`/session/${match.session_id}/results`)}
            >
              {match.restaurant_image_url ? (
                <Image source={{ uri: match.restaurant_image_url }} style={styles.recentMatchImage} />
              ) : (
                <View style={[styles.recentMatchImage, styles.recentMatchPlaceholder]}>
                  <Text style={styles.recentMatchEmoji}>🍽</Text>
                </View>
              )}
              <View style={styles.recentMatchMeta}>
                <Text style={styles.cardTitle} numberOfLines={1}>{match.restaurant_name}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>{match.session_name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#98a2b3" />
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.sectionLabel}>THIS WEEK</Text>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No sessions for this filter</Text>
          </View>
        ) : (
          filtered.map((session) => {
            const count = session.match_count || 0;
            const hasMatch = count > 0;

            return (
              <TouchableOpacity
                key={session.id}
                style={styles.historyCard}
                onPress={() => router.push(`/session/${session.id}/results`)}
              >
                <View style={styles.thumb}>
                  <Text style={styles.thumbEmoji}>{hasMatch ? '🍜' : '?'}</Text>
                </View>

                <View style={styles.cardMeta}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {hasMatch ? session.name : 'No consensus reached'}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>{session.name}</Text>
                  <Text style={styles.cardSubmeta}>{session.member_count || 1} people</Text>
                </View>

                <View style={styles.cardActions}>
                  <View style={[styles.matchPill, hasMatch ? styles.matchPillGood : styles.matchPillBad]}>
                    <Text style={[styles.matchPillText, hasMatch ? styles.matchTextGood : styles.matchTextBad]}>
                      {hasMatch ? 'Match ✓' : 'No Match'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color="#98a2b3" />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function StatCol({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.segment, active && styles.segmentActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginLeft: 38,
    color: '#101828',
    fontSize: 22,
    fontWeight: '800',
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe9ea',
  },
  content: {
    padding: 16,
    paddingBottom: 38,
  },
  statsCard: {
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 16,
    flexDirection: 'row',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#101828',
    fontWeight: '800',
    fontSize: 30,
  },
  statLabel: {
    marginTop: 2,
    color: '#667085',
    fontSize: 13,
  },
  segmentWrap: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#eaecf0',
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  segmentText: {
    color: '#667085',
    fontWeight: '700',
    fontSize: 15,
  },
  segmentTextActive: {
    color: '#101828',
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
    letterSpacing: 0.8,
  },
  historyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recentMatchCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recentMatchImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#7f8aa0',
  },
  recentMatchPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentMatchEmoji: {
    fontSize: 26,
    color: '#fff',
  },
  recentMatchMeta: {
    flex: 1,
  },
  thumb: {
    width: 74,
    height: 74,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7f8aa0',
  },
  thumbEmoji: {
    fontSize: 30,
    color: '#fff',
  },
  cardMeta: {
    flex: 1,
  },
  cardTitle: {
    color: '#101828',
    fontSize: 20,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#667085',
    fontSize: 18,
    marginTop: 2,
  },
  cardSubmeta: {
    marginTop: 2,
    color: '#98a2b3',
    fontSize: 13,
  },
  cardActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  matchPill: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  matchPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  matchPillGood: {
    backgroundColor: '#d9f3e3',
  },
  matchPillBad: {
    backgroundColor: '#fee4e2',
  },
  matchTextGood: {
    color: '#0f8a40',
  },
  matchTextBad: {
    color: '#d92d20',
  },
  emptyCard: {
    borderRadius: 18,
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    padding: 18,
  },
  emptyTitle: {
    color: '#344054',
    fontSize: 16,
    fontWeight: '700',
  },
});
