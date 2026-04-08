import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { RestaurantCard } from '@/components/RestaurantCard';
import { MatchModal } from '@/components/MatchModal';
import type { SessionDetails, SessionRestaurant, SwipeResponse } from '@bitebuddy/shared';

const DOT_COLORS = ['#22c55e', '#f4b400', '#94a3b8', '#60a5fa'];

export default function SwipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<SessionRestaurant[]>([]);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [matchMembers, setMatchMembers] = useState<{ id: string; name: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [matchRestaurant, setMatchRestaurant] = useState<SessionRestaurant | null>(null);
  const [showMatch, setShowMatch] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      void loadSwipeState();
    }, [id])
  );

  async function loadSwipeState() {
    setLoading(true);
    try {
      const [restaurantsData, sessionDetails] = await Promise.all([
        apiGet<SessionRestaurant[]>(`/api/sessions/${id}/restaurants`),
        apiGet<SessionDetails>(`/api/sessions/${id}`),
      ]);
      setRestaurants(restaurantsData);

      const members = Array.isArray(sessionDetails?.members)
        ? sessionDetails.members
            .map((member) => {
              const name = member.profile?.display_name || member.profile?.username;
              if (!name) return null;
              return { id: member.user_id, name };
            })
            .filter((member): member is { id: string; name: string } => Boolean(member))
        : [];

      setMatchMembers(members);
      setMemberNames(members.map((member) => member.name).slice(0, 4));
      setCurrentIndex(sessionDetails.user_swipe_count ?? 0);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel(`swipe-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `session_id=eq.${id}`,
        },
        (payload) => {
          const matchedRestaurantId = (payload.new as any).restaurant_id;
          const restaurant = restaurants.find((item) => item.id === matchedRestaurantId);
          if (restaurant && !showMatch) {
            setMatchRestaurant(restaurant);
            setShowMatch(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, restaurants, showMatch]);

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

      setCurrentIndex((prev) => prev + 1);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSwiping(false);
    }
  }

  const done = currentIndex >= restaurants.length;
  const current = done ? null : restaurants[currentIndex];
  const progress = restaurants.length === 0 ? 0 : Math.min(1, currentIndex / restaurants.length);

  const activeMembers = useMemo(() => memberNames, [memberNames]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#ff6f70" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Swipe</Text>
        <View style={styles.headerSpacer} />
      </View>

      {done ? (
        <View style={styles.doneWrap}>
          <Text style={styles.doneTitle}>All done!</Text>
          <Text style={styles.doneText}>Waiting for others to finish swiping...</Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.replace(`/session/${id}/results`)}>
            <Text style={styles.doneButtonText}>View Results</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.topBlock}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>PROGRESS</Text>
              <Text style={styles.progressCount}>
                {Math.min(currentIndex + 1, restaurants.length)} / {restaurants.length}
              </Text>
            </View>

            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>

            <View style={styles.membersStrip}>
              <View style={styles.membersList}>
                {activeMembers.slice(0, 3).map((name, index) => (
                  <View key={name} style={styles.memberItem}>
                    <View style={[styles.memberDot, { backgroundColor: DOT_COLORS[index] }]} />
                    <Text style={styles.memberText}>{name}</Text>
                  </View>
                ))}
                {activeMembers.length === 0 ? <Text style={styles.memberText}>No members yet</Text> : null}
              </View>
              <Text style={styles.membersCount}>{Math.min(currentIndex + 3, restaurants.length)} swiped</Text>
            </View>
          </View>

          {current ? (
            <View style={styles.cardWrap}>
              <RestaurantCard restaurant={current} />
            </View>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.circleButton} onPress={() => handleSwipe(false)} disabled={swiping}>
              <Ionicons name="close" size={44} color="#475467" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.circleButton, styles.infoButton]}
              onPress={() => Alert.alert('Details', current?.address || 'No address available')}
              disabled={!current}
            >
              <Ionicons name="information-circle-outline" size={40} color="#475467" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.circleButton, styles.likeButton]} onPress={() => handleSwipe(true)} disabled={swiping}>
              <Ionicons name="heart" size={38} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}

      <MatchModal
        visible={showMatch}
        restaurant={matchRestaurant}
        members={matchMembers}
        onClose={() => setShowMatch(false)}
      />
    </SafeAreaView>
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
    borderBottomColor: '#e9edf1',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaecf0',
  },
  headerSpacer: {
    width: 46,
    height: 46,
  },
  headerTitle: {
    color: '#101828',
    fontSize: 22,
    fontWeight: '800',
  },
  topBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  progressCount: {
    color: '#344054',
    fontWeight: '700',
    fontSize: 20,
  },
  track: {
    marginTop: 10,
    borderRadius: 8,
    height: 12,
    backgroundColor: '#d0d5dd',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#ff6f70',
    borderRadius: 8,
  },
  membersStrip: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  membersList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  memberText: {
    fontSize: 15,
    color: '#344054',
  },
  membersCount: {
    color: '#667085',
    fontSize: 15,
  },
  cardWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 16,
    paddingBottom: 26,
  },
  circleButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#101828',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 5,
  },
  infoButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  likeButton: {
    backgroundColor: '#ff6f70',
  },
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  doneTitle: {
    color: '#101828',
    fontSize: 42,
    fontWeight: '800',
  },
  doneText: {
    marginTop: 6,
    color: '#667085',
    fontSize: 20,
    textAlign: 'center',
  },
  doneButton: {
    marginTop: 20,
    borderRadius: 24,
    backgroundColor: '#ff6f70',
    paddingHorizontal: 26,
    paddingVertical: 14,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
});
