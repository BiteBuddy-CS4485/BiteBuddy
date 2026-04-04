import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPost, apiDelete } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { shadow } from '../../../lib/shadows';
import { supabase } from '../../../lib/supabase';
import { RestaurantCard } from '../../../components/RestaurantCard';
import { MatchModal } from '../../../components/MatchModal';
import type { SessionRestaurant, SwipeResponse } from '@bitebuddy/shared';

export default function SwipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<SessionRestaurant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [matchRestaurant, setMatchRestaurant] = useState<SessionRestaurant | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState('');

  const restaurantsRef = useRef<SessionRestaurant[]>([]);
  const showMatchRef = useRef(false);
  restaurantsRef.current = restaurants;
  showMatchRef.current = showMatch;

  useEffect(() => { loadRestaurants(); }, [id]);

  async function loadRestaurants() {
    try {
      const [{ restaurants: data, user_swipe_count }, sessionData] = await Promise.all([
        apiGet<{ restaurants: SessionRestaurant[]; user_swipe_count: number }>(`/api/sessions/${id}/restaurants`),
        apiGet<{ created_by: string }>(`/api/sessions/${id}`),
      ]);
      setRestaurants(data);
      setCurrentIndex(user_swipe_count);
      setCreatedBy(sessionData.created_by);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmLeaveOrCancel() {
    const isCreator = createdBy === user?.id;
    setActioning(true);
    setActionError('');
    try {
      if (isCreator) {
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

  useEffect(() => {
    const channel = supabase
      .channel(`swipe-session-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `id=eq.${id}`,
      }, (payload) => {
        if ((payload.new as any)?.status === 'cancelled') {
          Alert.alert('Session Cancelled', 'The host has cancelled this session.');
          router.replace('/(tabs)');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    const channel = supabase
      .channel(`swipe-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'matches',
        filter: `session_id=eq.${id}`,
      }, (payload) => {
        const matchedRestaurantId = (payload.new as any).restaurant_id;
        const restaurant = restaurantsRef.current.find(r => r.id === matchedRestaurantId);
        if (restaurant && !showMatchRef.current) {
          setMatchRestaurant(restaurant);
          setShowMatch(true);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function handleSwipe(liked: boolean) {
    if (swiping || currentIndex >= restaurants.length) return;
    const restaurant = restaurants[currentIndex];
    setSwiping(true);
    try {
      const result = await apiPost<SwipeResponse>(`/api/sessions/${id}/swipe`, {
        restaurant_id: restaurant.id,
        liked,
      });
      if (result.is_match) {
        setMatchRestaurant(restaurant);
        setShowMatch(true);
      }
      setCurrentIndex(prev => prev + 1);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSwiping(false);
    }
  }

  if (loading) {
    return <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />;
  }

  const done = currentIndex >= restaurants.length;
  const current = done ? null : restaurants[currentIndex];
  const progressPct = restaurants.length > 0 ? (currentIndex / restaurants.length) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Swipe</Text>
          <Text style={styles.progressText}>
            {Math.min(currentIndex + 1, restaurants.length)} / {restaurants.length}
          </Text>
        </View>
        <TouchableOpacity style={styles.leaveBtn} onPress={() => setConfirming(true)}>
          <Text style={styles.leaveBtnText}>Leave</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      {/* Leave/Cancel confirmation modal */}
      <Modal visible={confirming} transparent animationType="fade">
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmOverlay}>
            <Text style={styles.confirmText}>
              {createdBy === user?.id ? 'End the session for everyone?' : 'Leave this session?'}
            </Text>
            {actionError ? <Text style={styles.confirmError}>{actionError}</Text> : null}
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.confirmNo}
                onPress={() => { setConfirming(false); setActionError(''); }}
                disabled={actioning}
              >
                <Text style={styles.confirmNoText}>Stay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmYes} onPress={confirmLeaveOrCancel} disabled={actioning}>
                {actioning
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmYesText}>
                      {createdBy === user?.id ? 'Cancel Session' : 'Leave'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {done ? (
        <View style={styles.doneContainer}>
          <Text style={styles.doneTitle}>All done!</Text>
          <Text style={styles.doneText}>Waiting for others to finish swiping...</Text>
          <TouchableOpacity
            style={styles.resultsButton}
            onPress={() => router.replace(`/session/${id}/results`)}
          >
            <Text style={styles.resultsButtonText}>View Results</Text>
          </TouchableOpacity>
        </View>
      ) : current ? (
        <>
          <View style={styles.cardContainer}>
            <RestaurantCard restaurant={current} />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.nopeBtn, swiping && styles.actionBtnSwiping]}
              onPress={() => handleSwipe(false)}
              disabled={swiping}
              activeOpacity={0.8}
            >
              {swiping ? <ActivityIndicator size="small" color="#bbb" /> : <Text style={styles.nopeBtnText}>✕</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.infoBtn]}
              disabled
            >
              <Text style={styles.infoBtnText}>ⓘ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.likeBtn, swiping && styles.actionBtnSwiping]}
              onPress={() => handleSwipe(true)}
              disabled={swiping}
              activeOpacity={0.8}
            >
              {swiping ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.likeBtnText}>♥</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      <MatchModal
        visible={showMatch}
        restaurant={matchRestaurant}
        onClose={() => setShowMatch(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  loader: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 18, color: '#555', lineHeight: 20 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  progressText: { fontSize: 12, fontWeight: '500', color: '#aaa', marginTop: 1 },
  leaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff0f0',
  },
  leaveBtnText: { fontSize: 13, fontWeight: '600', color: '#e53935' },
  progressSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#fff',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmOverlay: {
    width: '100%',
    backgroundColor: '#fff3f3',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ffcdd2',
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
  cardContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  actionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(0, 2, 6, 0.12),
  },
  actionBtnSwiping: {
    opacity: 0.5,
  },
  nopeBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  infoBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  likeBtn: {
    backgroundColor: '#FF6B35',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  nopeBtnText: { fontSize: 26, color: '#bbb', fontWeight: '300' },
  infoBtnText: { fontSize: 18, color: '#bbb' },
  likeBtnText: { fontSize: 30, color: '#fff' },
  doneContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  doneTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  doneText: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 24 },
  resultsButton: {
    backgroundColor: '#FF6B35', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28,
  },
  resultsButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
