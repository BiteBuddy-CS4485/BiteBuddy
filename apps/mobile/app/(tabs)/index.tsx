import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, Image, Dimensions, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { apiGet } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SessionCard } from '../../components/SessionCard';
import { shadow } from '../../lib/shadows';
import { CompactRestaurantCard } from '../../components/CompactRestaurantCard';
import {
  CUISINE_CATEGORIES,
  type CuisineKey,
  type PlaceBusinessDTO,
  type DiscoverRestaurantsResponse,
  type RecentMatchDTO,
  type RecentMatchesResponse,
} from '@bitebuddy/shared';
import type { Session } from '@bitebuddy/shared';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Location
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  // Restaurants
  const [selectedCuisine, setSelectedCuisine] = useState<CuisineKey>('all');
  const [restaurants, setRestaurants] = useState<PlaceBusinessDTO[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);

  // Recent matches
  const [recentMatches, setRecentMatches] = useState<RecentMatchDTO[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      requestLocation();
      loadSessions();
      loadRecentMatches();
    }, [])
  );

  // Realtime: listen for session invites targeting this user
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('home-invites')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_members',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          loadSessions();
          Alert.alert('New Session Invite', "You've been invited to a session!");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Fetch restaurants when location or cuisine changes
  useEffect(() => {
    if (location) {
      loadRestaurants();
    }
  }, [location, selectedCuisine]);

  async function requestLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        return;
      }
      setLocationDenied(false);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch {
      setLocationDenied(true);
    }
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

  async function loadRestaurants() {
    if (!location) return;
    try {
      setRestaurantsLoading(true);
      const params = new URLSearchParams({
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
        cuisine: selectedCuisine,
      });
      const data = await apiGet<DiscoverRestaurantsResponse>(
        `/api/restaurants/discover?${params.toString()}`
      );
      setRestaurants(data.restaurants);
    } catch {
      setRestaurants([]);
    } finally {
      setRestaurantsLoading(false);
    }
  }

  async function loadRecentMatches() {
    try {
      setMatchesLoading(true);
      const data = await apiGet<RecentMatchesResponse>('/api/sessions/recent-matches?limit=10');
      setRecentMatches(data.matches);
    } catch {
      setRecentMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([requestLocation(), loadSessions(), loadRecentMatches()]);
    setRefreshing(false);
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

  const activeSessions = sessions.filter(s => s.status !== 'completed');
  const displayName = profile?.display_name ?? profile?.username ?? 'there';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>Hey, {displayName}!</Text>
          <Text style={styles.greetingSubtitle}>Where are we eating today?</Text>
        </View>

        {/* Active Sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          {sessionsLoading ? (
            <ActivityIndicator color="#FF6B35" style={styles.sectionLoader} />
          ) : activeSessions.length === 0 ? (
            <TouchableOpacity
              style={styles.ctaCard}
              onPress={() => router.push('/session/create')}
              activeOpacity={0.7}
            >
              <Text style={styles.ctaTitle}>Start a Session</Text>
              <Text style={styles.ctaText}>Swipe on restaurants with friends!</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {activeSessions.map(session => (
                <View key={session.id} style={styles.horizontalCard}>
                  <SessionCard session={session} onPress={() => handleSessionPress(session)} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Explore Nearby */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore Nearby</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CUISINE_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={[styles.chip, selectedCuisine === cat.key && styles.chipSelected]}
                onPress={() => setSelectedCuisine(cat.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedCuisine === cat.key && styles.chipTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {locationDenied ? (
            <View style={styles.inlineMessage}>
              <Text style={styles.inlineMessageText}>
                Enable location access to discover nearby restaurants.
              </Text>
            </View>
          ) : restaurantsLoading ? (
            <ActivityIndicator color="#FF6B35" style={styles.sectionLoader} />
          ) : restaurants.length === 0 ? (
            <Text style={styles.emptyText}>No restaurants found for this category.</Text>
          ) : (
            <View style={styles.restaurantGrid}>
              {restaurants.map(r => (
                <View key={r.id} style={styles.gridItem}>
                  <CompactRestaurantCard restaurant={r} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Matches */}
        {!matchesLoading && recentMatches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Matches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {recentMatches.map(match => (
                <TouchableOpacity
                  key={match.match_id}
                  style={styles.matchCard}
                  onPress={() => router.push(`/session/${match.session_id}/results`)}
                  activeOpacity={0.7}
                >
                  {match.restaurant_image_url ? (
                    <Image source={{ uri: match.restaurant_image_url }} style={styles.matchImage} />
                  ) : (
                    <View style={[styles.matchImage, styles.matchPlaceholder]}>
                      <Text style={styles.matchPlaceholderText}>No Photo</Text>
                    </View>
                  )}
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchRestaurant} numberOfLines={1}>{match.restaurant_name}</Text>
                    <Text style={styles.matchSession} numberOfLines={1}>{match.session_name}</Text>
                    {match.restaurant_rating != null && (
                      <Text style={styles.matchRating}>&#9733; {match.restaurant_rating.toFixed(1)}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom spacer for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/session/create')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  greeting: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  greetingSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionLoader: {
    paddingVertical: 20,
  },
  horizontalList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  horizontalCard: {
    width: SCREEN_WIDTH * 0.75,
  },
  ctaCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderStyle: 'dashed',
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  ctaText: {
    fontSize: 14,
    color: '#BF360C',
  },
  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  chipText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  inlineMessage: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
  },
  inlineMessageText: {
    fontSize: 14,
    color: '#F57F17',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  restaurantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
  },
  gridItem: {
    // width controlled by CompactRestaurantCard
  },
  matchCard: {
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    ...shadow(0, 1, 4, 0.08),
  },
  matchImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#e0e0e0',
  },
  matchPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchPlaceholderText: {
    color: '#999',
    fontSize: 12,
  },
  matchInfo: {
    padding: 8,
  },
  matchRestaurant: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  matchSession: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  matchRating: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(0, 2, 6, 0.25),
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
});
