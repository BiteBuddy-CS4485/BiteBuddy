import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPost, apiDelete } from '../../../lib/api';
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
  const [confirming, setConfirming] = useState<'cancel' | 'leave' | null>(null);
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState('');

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
        const status = (payload.new as any)?.status;
        if (status === 'active') {
          router.replace(`/session/${id}/swipe`);
        } else if (status === 'cancelled') {
          Alert.alert('Session Cancelled', 'The host has cancelled this session.');
          router.replace('/(tabs)');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function handleShare() {
    if (!session?.invite_code) return;
    try {
      await Share.share({
        message: `Join my BiteBuddy session "${session.name}"!\nUse invite code: ${session.invite_code}`,
      });
    } catch {
      // user dismissed share sheet — no-op
    }
  }

  async function confirmAction() {
    setActioning(true);
    setActionError('');
    try {
      if (confirming === 'cancel') {
        await apiPost(`/api/sessions/${id}/cancel`);
      } else {
        await apiDelete(`/api/sessions/${id}/leave`);
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      setActionError(err.message ?? 'Something went wrong');
    } finally {
      setActioning(false);
    }
  }

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

      {session.invite_code && (
        <TouchableOpacity style={styles.inviteBox} onPress={handleShare} activeOpacity={0.7}>
          <Text style={styles.inviteLabel}>INVITE CODE</Text>
          <Text style={styles.inviteCode}>{session.invite_code}</Text>
          <Text style={styles.inviteHint}>Tap to share</Text>
        </TouchableOpacity>
      )}

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

      <View style={styles.bottomBar}>
        {confirming ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              {confirming === 'cancel'
                ? 'End the session for everyone?'
                : 'Leave this session?'}
            </Text>
            {actionError ? <Text style={styles.confirmError}>{actionError}</Text> : null}
            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.confirmNo} onPress={() => { setConfirming(null); setActionError(''); }} disabled={actioning}>
                <Text style={styles.confirmNoText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmYes} onPress={confirmAction} disabled={actioning}>
                {actioning
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmYesText}>
                      {confirming === 'cancel' ? 'Cancel Session' : 'Leave'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {isCreator ? (
              <>
                <TouchableOpacity
                  style={[styles.startButton, starting && styles.buttonDisabled]}
                  onPress={handleStart}
                  disabled={starting}
                >
                  {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.startButtonText}>Start Session</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setConfirming('cancel')}>
                  <Text style={styles.cancelButtonText}>Cancel Session</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.waitingBar}>
                  <Text style={styles.waitingText}>Waiting for the host to start...</Text>
                </View>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setConfirming('leave')}>
                  <Text style={styles.cancelButtonText}>Leave Session</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>
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
  inviteBox: {
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: '#FFF0E8',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    padding: 16,
    alignItems: 'center',
  },
  inviteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6B35',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  inviteCode: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 6,
  },
  inviteHint: {
    fontSize: 12,
    color: '#FF6B35',
    marginTop: 6,
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
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    gap: 10,
    backgroundColor: '#fff',
  },
  startButton: {
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
  cancelButton: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#e53935',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBox: {
    backgroundColor: '#fff3f3',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  confirmError: {
    fontSize: 13,
    color: '#e53935',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmNo: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  confirmNoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  confirmYes: {
    flex: 1,
    backgroundColor: '#e53935',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  confirmYesText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
