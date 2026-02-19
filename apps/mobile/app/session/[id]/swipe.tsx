import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPost } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { RestaurantCard } from '../../../components/RestaurantCard';
import { MatchModal } from '../../../components/MatchModal';
import type { SessionRestaurant, SwipeResponse } from '@bitebuddy/shared';

export default function SwipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<SessionRestaurant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [matchRestaurant, setMatchRestaurant] = useState<SessionRestaurant | null>(null);
  const [showMatch, setShowMatch] = useState(false);

  useEffect(() => {
    loadRestaurants();
  }, [id]);

  async function loadRestaurants() {
    try {
      const data = await apiGet<SessionRestaurant[]>(`/api/sessions/${id}/restaurants`);
      setRestaurants(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Realtime: listen for matches (from other users' swipes)
  useEffect(() => {
    const channel = supabase
      .channel(`swipe-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `session_id=eq.${id}`,
      }, (payload) => {
        const matchedRestaurantId = (payload.new as any).restaurant_id;
        const restaurant = restaurants.find(r => r.id === matchedRestaurantId);
        if (restaurant && !showMatch) {
          setMatchRestaurant(restaurant);
          setShowMatch(true);
        }
      })
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progress}>
          {Math.min(currentIndex + 1, restaurants.length)} / {restaurants.length}
        </Text>
      </View>

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
              style={[styles.actionBtn, styles.nopeBtn]}
              onPress={() => handleSwipe(false)}
              disabled={swiping}
            >
              <Text style={styles.nopeBtnText}>✕</Text>
              <Text style={styles.actionLabel}>Nope</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.likeBtn]}
              onPress={() => handleSwipe(true)}
              disabled={swiping}
            >
              <Text style={styles.likeBtnText}>♥</Text>
              <Text style={[styles.actionLabel, { color: '#fff' }]}>Like</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loader: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  progress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  cardContainer: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  nopeBtn: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  likeBtn: {
    backgroundColor: '#FF6B35',
  },
  nopeBtnText: {
    fontSize: 28,
    color: '#999',
    fontWeight: '300',
  },
  likeBtnText: {
    fontSize: 28,
    color: '#fff',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    marginTop: 2,
  },
  doneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  doneText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  resultsButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  resultsButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
