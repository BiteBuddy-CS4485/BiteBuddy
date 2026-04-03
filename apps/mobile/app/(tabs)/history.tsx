import React, { useCallback, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { apiGet } from '../../lib/api';
import type { Session, SessionDetails, FriendWithProfile } from '@bitebuddy/shared';

type FilterType = 'all' | 'match' | 'nomatch';

export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [friendCount, setFriendCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  async function loadHistory() {
    try {
      const [data, friendsData] = await Promise.all([
        apiGet<Session[]>('/api/sessions?status=completed,cancelled'),
        apiGet<FriendWithProfile[]>('/api/friends').catch(() => [] as FriendWithProfile[]),
      ]);
      setSessions(data);
      setFriendCount((friendsData ?? []).length);

      const counts: Record<string, number> = {};
      const members: Record<string, number> = {};
      await Promise.all(
        data.map(async (session) => {
          try {
            const details = await apiGet<SessionDetails>(`/api/sessions/${session.id}`);
            counts[session.id] = details.match_count;
            members[session.id] = details.members?.length ?? 0;
          } catch {
            counts[session.id] = 0;
            members[session.id] = 0;
          }
        })
      );
      setMatchCounts(counts);
      setMemberCounts(members);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadHistory();
  }

  function formatGroupDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) return 'THIS WEEK';
    if (diffDays <= 14) return 'LAST WEEK';
    const month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    return month;
  }

  function formatDisplayDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const totalMatches = Object.values(matchCounts).reduce((sum, c) => sum + c, 0);

  const filteredSessions = sessions.filter(s => {
    if (filter === 'match') return (matchCounts[s.id] ?? 0) > 0;
    if (filter === 'nomatch') return (matchCounts[s.id] ?? 0) === 0;
    return true;
  });

  // Group by week/month
  const grouped: Record<string, Session[]> = {};
  for (const s of filteredSessions) {
    const key = formatGroupDate(s.created_at);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }
  const sections = Object.entries(grouped).map(([title, data]) => ({ title, data }));

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Row */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{sessions.length}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalMatches}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{friendCount}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'match', 'nomatch'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All' : f === 'match' ? 'Matches' : 'No Match'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyText}>
            Once you finish a swiping session, it will appear here.
          </Text>
        </View>
      ) : filteredSessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No sessions match this filter</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          renderItem={({ item }) => {
            const matchCount = matchCounts[item.id] ?? 0;
            const memberCount = memberCounts[item.id] ?? 0;
            const hasMatch = matchCount > 0;
            return (
              <TouchableOpacity
                style={styles.sessionCard}
                onPress={() => router.push(`/session/${item.id}/results`)}
                activeOpacity={0.7}
              >
                <View style={styles.sessionCardLeft}>
                  <View style={styles.sessionIcon}>
                    <Text style={styles.sessionIconText}>{hasMatch ? '🍽' : '?'}</Text>
                  </View>
                  <View style={styles.sessionInfo}>
                    <View style={styles.sessionNameRow}>
                      <Text style={styles.sessionName} numberOfLines={1}>{item.name}</Text>
                      <View style={[styles.matchBadge, hasMatch ? styles.matchBadgeYes : styles.matchBadgeNo]}>
                        <Text style={[styles.matchBadgeText, hasMatch ? styles.matchBadgeTextYes : styles.matchBadgeTextNo]}>
                          {hasMatch ? `${matchCount} match${matchCount !== 1 ? 'es' : ''} ✓` : 'No Match'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.sessionMeta}>
                      {memberCount > 0 ? `${memberCount} people · ` : ''}
                      {formatDisplayDate(item.created_at)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sessionChevron}>›</Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF6B35" />
          }
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
  },
  filterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  list: {
    paddingBottom: 24,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sessionCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionIcon: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#607D8B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  sessionIconText: {
    fontSize: 24,
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sessionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    flexShrink: 1,
  },
  matchBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchBadgeYes: {
    backgroundColor: '#E8F5E9',
  },
  matchBadgeNo: {
    backgroundColor: '#FFE8E8',
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  matchBadgeTextYes: {
    color: '#2E7D32',
  },
  matchBadgeTextNo: {
    color: '#C62828',
  },
  sessionMeta: {
    fontSize: 13,
    color: '#888',
  },
  sessionChevron: {
    fontSize: 22,
    color: '#ccc',
    marginLeft: 8,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
});
