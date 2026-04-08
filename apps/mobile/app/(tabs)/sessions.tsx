import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

export default function SessionsTabScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [])
  );

  async function loadSessions() {
    try {
      const data = await apiGet<any>('/api/sessions');
      if (Array.isArray(data)) setSessions(data);
      else if (Array.isArray(data?.data)) setSessions(data.data);
      else setSessions([]);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const activeSessions = useMemo(
    () => sessions.filter((session) => session.status !== 'completed'),
    [sessions]
  );
  const completedSessions = useMemo(
    () => sessions.filter((session) => session.status === 'completed'),
    [sessions]
  );

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
        <Text style={styles.headerTitle}>Sessions</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/session/create')}>
          <Ionicons name="add" size={26} color="#ff6f70" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadSessions();
            }}
            tintColor="#ff6f70"
          />
        }
      >
        <Text style={styles.sectionLabel}>ACTIVE SESSIONS</Text>
        {activeSessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active sessions</Text>
            <Text style={styles.emptyText}>Create a new session to start swiping with friends.</Text>
          </View>
        ) : (
          activeSessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onPress={() => router.push(`/session/${session.id}/lobby`)}
              activeOpacity={0.9}
            >
              <Text style={styles.sessionTitle}>{session.name || 'Untitled session'}</Text>
              <Text style={styles.sessionMeta}>Tap to continue in lobby</Text>
              <View style={styles.livePill}>
                <Text style={styles.livePillText}>Live</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.sectionLabel}>PAST SESSIONS</Text>
        {completedSessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No completed sessions</Text>
          </View>
        ) : (
          completedSessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionRow}
              onPress={() => router.push(`/session/${session.id}/results`)}
            >
              <View>
                <Text style={styles.rowTitle}>{session.name || 'Session'}</Text>
                <Text style={styles.rowMeta}>View match results</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#98a2b3" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  header: {
    height: 94,
    backgroundColor: '#f8fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e9edf1',
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
    color: '#0f172a',
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
    paddingBottom: 42,
  },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 10,
    fontSize: 13,
    letterSpacing: 0.9,
    color: '#667085',
    fontWeight: '700',
  },
  sessionCard: {
    borderRadius: 20,
    backgroundColor: '#ff7b67',
    padding: 18,
    marginBottom: 12,
    shadowColor: '#7d4b3b',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 5,
  },
  sessionTitle: {
    color: '#fff',
    fontSize: 23,
    fontWeight: '800',
  },
  sessionMeta: {
    marginTop: 4,
    color: '#ffe9e6',
    fontSize: 16,
  },
  livePill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  livePillText: {
    color: '#344054',
    fontWeight: '700',
    fontSize: 14,
  },
  sessionRow: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 18,
  },
  rowMeta: {
    marginTop: 2,
    color: '#667085',
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 18,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#344054',
    fontWeight: '700',
    fontSize: 18,
  },
  emptyText: {
    marginTop: 4,
    color: '#667085',
    fontSize: 14,
  },
});
