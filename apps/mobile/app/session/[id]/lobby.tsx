import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPost } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { SessionDetails } from '@bitebuddy/shared';

export default function LobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  async function loadSession() {
    try {
      const data = await apiGet<SessionDetails>(`/api/sessions/${id}`);
      setSession(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, [id]);

  // Realtime: listen for new members joining
  useEffect(() => {
    const channel = supabase
      .channel(`lobby-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'session_members',
        filter: `session_id=eq.${id}`,
      }, () => {
        loadSession();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${id}`,
      }, (payload) => {
        if (payload.new && (payload.new as any).status === 'active') {
          router.replace(`/session/${id}/swipe`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function handleStart() {
    setStarting(true);
    try {
      await apiPost(`/api/sessions/${id}/start`);
      router.replace(`/session/${id}/swipe`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setStarting(false);
    }
  }

  if (loading || !session) {
    return <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />;
  }

  const isCreator = session.created_by === user?.id;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{session.name}</Text>
      <Text style={styles.subtitle}>Waiting for everyone to join...</Text>

      <Text style={styles.sectionTitle}>
        Members ({session.members.length})
      </Text>

      <FlatList
        data={session.members}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            {item.profile?.avatar_url ? (
              <Image source={{ uri: item.profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.profile?.display_name ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.memberName}>{item.profile?.display_name ?? 'Unknown'}</Text>
              <Text style={styles.memberUsername}>@{item.profile?.username ?? ''}</Text>
            </View>
            {item.user_id === session.created_by && (
              <Text style={styles.creatorBadge}>Creator</Text>
            )}
          </View>
        )}
        contentContainerStyle={styles.list}
      />

      {isCreator && (
        <TouchableOpacity
          style={[styles.startButton, starting && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={starting}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>Start Session</Text>
          )}
        </TouchableOpacity>
      )}

      {!isCreator && (
        <View style={styles.waitingBar}>
          <Text style={styles.waitingText}>Waiting for the host to start...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loader: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  memberUsername: {
    fontSize: 13,
    color: '#888',
  },
  creatorBadge: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
    backgroundColor: '#FFF0E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  startButton: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  waitingBar: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  waitingText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
});
