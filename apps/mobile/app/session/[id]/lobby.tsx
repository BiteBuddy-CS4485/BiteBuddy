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

  useEffect(() => { loadSession(); }, [id]);

  useEffect(() => {
    const channel = supabase
      .channel(`lobby-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'session_members',
        filter: `session_id=eq.${id}`,
      }, () => { loadSession(); })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions',
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
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function handleShare() {
    if (!session?.invite_code) return;
    try {
      await Share.share({
        message: `Join my BiteBuddy session "${session.name}"!\nUse invite code: ${session.invite_code}`,
      });
    } catch { /* dismissed */ }
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
  const radiusMi = session.radius_meters ? (session.radius_meters / 1609).toFixed(1) : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Setup</Text>
        <TouchableOpacity style={styles.headerIconBtn} onPress={handleShare}>
          <Text style={styles.headerIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={session.members}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <>
            <Text style={styles.sessionName}>{session.name}</Text>

            {/* Session Settings */}
            {(radiusMi || session.price_filter || session.category_filter) && (
              <>
                <Text style={styles.sectionLabel}>SESSION SETTINGS</Text>
                <View style={styles.settingsCard}>
                  {radiusMi && (
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Radius</Text>
                      <Text style={styles.settingValue}>{radiusMi} mi</Text>
                    </View>
                  )}
                  {session.price_filter && session.price_filter.length > 0 && (
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Price</Text>
                      <Text style={styles.settingValue}>{session.price_filter.join(' - ')}</Text>
                    </View>
                  )}
                  {session.category_filter && (
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Category</Text>
                      <Text style={styles.settingValue}>{session.category_filter}</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Invite code */}
            {session.invite_code && (
              <TouchableOpacity style={styles.inviteBox} onPress={handleShare} activeOpacity={0.7}>
                <Text style={styles.inviteLabel}>INVITE CODE</Text>
                <Text style={styles.inviteCode}>{session.invite_code}</Text>
                <Text style={styles.inviteHint}>Tap to share</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionLabel}>
              PARTICIPANTS ({session.members.length})
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const isHost = item.user_id === session.created_by;
          const initial = (item.profile?.display_name ?? '?').charAt(0).toUpperCase();
          return (
            <View style={styles.memberRow}>
              {item.profile?.avatar_url ? (
                <Image source={{ uri: item.profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.profile?.display_name ?? 'Unknown'}</Text>
                <Text style={styles.memberUsername}>
                  {isHost ? 'Host' : 'Joined'}
                </Text>
              </View>
              <View style={[styles.statusBadge, isHost ? styles.statusBadgeReady : styles.statusBadgePending]}>
                <Text style={[styles.statusBadgeText, isHost ? styles.statusBadgeTextReady : styles.statusBadgeTextPending]}>
                  {isHost ? 'Ready' : 'Ready'}
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        style={styles.memberList}
      />

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        {confirming ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              {confirming === 'cancel' ? 'End the session for everyone?' : 'Leave this session?'}
            </Text>
            {actionError ? <Text style={styles.confirmError}>{actionError}</Text> : null}
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.confirmNo}
                onPress={() => { setConfirming(null); setActionError(''); }}
                disabled={actioning}
              >
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
        ) : isCreator ? (
          <>
            <TouchableOpacity
              style={[styles.startButton, starting && styles.buttonDisabled]}
              onPress={handleStart}
              disabled={starting}
            >
              {starting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.startButtonText}>Start Swiping →</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.destructiveBtn} onPress={() => setConfirming('cancel')}>
              <Text style={styles.destructiveBtnText}>Cancel Session</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.waitingBar}>
              <Text style={styles.waitingText}>Waiting for the host to start...</Text>
            </View>
            <TouchableOpacity style={styles.destructiveBtn} onPress={() => setConfirming('leave')}>
              <Text style={styles.destructiveBtnText}>Leave Session</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 18, color: '#555', lineHeight: 20 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF0E8', alignItems: 'center', justifyContent: 'center',
  },
  headerIcon: { fontSize: 18 },
  sessionName: {
    fontSize: 24, fontWeight: '800', color: '#1a1a1a',
    paddingHorizontal: 20, marginTop: 20, marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 0.8,
    paddingHorizontal: 20, marginBottom: 8,
  },
  settingsCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 14,
    gap: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  settingItem: { alignItems: 'center', flex: 1 },
  settingLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  settingValue: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  inviteBox: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFF0E8',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    padding: 16,
    alignItems: 'center',
  },
  inviteLabel: { fontSize: 11, fontWeight: '700', color: '#FF6B35', letterSpacing: 1.5, marginBottom: 6 },
  inviteCode: { fontSize: 32, fontWeight: '800', color: '#1a1a1a', letterSpacing: 6 },
  inviteHint: { fontSize: 12, color: '#FF6B35', marginTop: 6 },
  list: { paddingHorizontal: 20, paddingBottom: 16 },
  memberList: { flex: 1 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#607D8B', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  memberUsername: { fontSize: 13, color: '#888' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeReady: { backgroundColor: '#E8F5E9' },
  statusBadgePending: { backgroundColor: '#f5f5f5' },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  statusBadgeTextReady: { color: '#2E7D32' },
  statusBadgeTextPending: { color: '#888' },
  bottomBar: {
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, gap: 8,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  startButton: {
    backgroundColor: '#FF6B35', borderRadius: 28, padding: 18, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  startButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  waitingBar: {
    backgroundColor: '#f5f5f5', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  waitingText: { color: '#888', fontSize: 15, fontWeight: '500' },
  destructiveBtn: { borderRadius: 14, padding: 14, alignItems: 'center' },
  destructiveBtnText: { color: '#e53935', fontSize: 15, fontWeight: '600' },
  confirmBox: {
    backgroundColor: '#fff3f3', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#ffcdd2',
  },
  confirmError: { fontSize: 13, color: '#e53935', textAlign: 'center', marginBottom: 8 },
  confirmText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', textAlign: 'center', marginBottom: 12 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  confirmNo: {
    flex: 1, backgroundColor: '#f0f0f0', borderRadius: 10, padding: 12, alignItems: 'center',
  },
  confirmNoText: { fontSize: 15, fontWeight: '600', color: '#555' },
  confirmYes: {
    flex: 1, backgroundColor: '#e53935', borderRadius: 10, padding: 12, alignItems: 'center',
  },
  confirmYesText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
