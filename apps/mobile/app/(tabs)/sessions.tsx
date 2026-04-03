import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { apiGet } from '../../lib/api';
import { SessionCard } from '../../components/SessionCard';
import { CompactRestaurantCard } from '../../components/CompactRestaurantCard';
import {
  CUISINE_CATEGORIES,
  type CuisineKey,
  type PlaceBusinessDTO,
  type DiscoverRestaurantsResponse,
} from '@bitebuddy/shared';
import type { Session } from '@bitebuddy/shared';

export default function SessionsScreen() {
  const router = useRouter();

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

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
      requestLocation();
    }, [])
  );

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

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadSessions(), requestLocation()]);
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

  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const activeSessions = sessions.filter(s =>
    s.status !== 'completed' &&
    s.status !== 'cancelled' &&
    Date.now() - new Date(s.created_at).getTime() < TWENTY_FOUR_HOURS
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Sessions */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Sessions</Text>
            <TouchableOpacity
              style={styles.newBtn}
              onPress={() => router.push('/session/create')}
            >
              <Text style={styles.newBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>

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
            activeSessions.map(session => (
              <View key={session.id} style={styles.sessionItem}>
                <SessionCard session={session} onPress={() => handleSessionPress(session)} />
              </View>
            ))
          )}
        </View>

        {/* Explore Nearby */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore Nearby</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
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

        <View style={{ height: 24 }} />
      </ScrollView>
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
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  newBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionLoader: {
    paddingVertical: 20,
  },
  sessionItem: {
    paddingHorizontal: 16,
    marginBottom: 8,
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
});
