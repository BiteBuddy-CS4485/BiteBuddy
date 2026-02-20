import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet } from '../../../lib/api';
import { shadow } from '../../../lib/shadows';
import type { SessionResults, SessionRestaurant, Match } from '@bitebuddy/shared';

type MatchWithRestaurant = Match & { restaurant: SessionRestaurant };

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [results, setResults] = useState<SessionResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [id]);

  async function loadResults() {
    try {
      const data = await apiGet<SessionResults>(`/api/sessions/${id}/results`);
      setResults(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  function openInMaps(url: string | null) {
    if (url) Linking.openURL(url);
  }

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!results) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Could not load results</Text>
      </View>
    );
  }

  const matches = results.matches as MatchWithRestaurant[];

  function renderMatchCard({ item }: { item: MatchWithRestaurant }) {
    const r = item.restaurant;
    return (
      <View style={styles.card}>
        {r.image_url ? (
          <Image source={{ uri: r.image_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={styles.placeholderText}>No Photo</Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {r.name}
          </Text>

          <View style={styles.metaRow}>
            {r.rating != null && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingStar}>&#9733;</Text>
                <Text style={styles.ratingValue}>{r.rating}</Text>
              </View>
            )}
            {r.price && <Text style={styles.priceLevel}>{r.price}</Text>}
            {r.review_count != null && (
              <Text style={styles.reviewCount}>
                ({r.review_count} reviews)
              </Text>
            )}
          </View>

          {r.categories && r.categories.length > 0 && (
            <Text style={styles.categories} numberOfLines={1}>
              {r.categories.map((c) => c.title).join(', ')}
            </Text>
          )}

          {r.address && (
            <Text style={styles.address} numberOfLines={2}>
              {r.address}
            </Text>
          )}

          {r.yelp_url && (
            <TouchableOpacity
              style={styles.mapsButton}
              onPress={() => openInMaps(r.yelp_url)}
              activeOpacity={0.7}
            >
              <Text style={styles.mapsButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Results</Text>
        <Text style={styles.subtitle}>
          {matches.length} {matches.length === 1 ? 'match' : 'matches'} from{' '}
          {results.total_restaurants} restaurants
        </Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.noMatches}>
          <Text style={styles.noMatchesIcon}>&#128532;</Text>
          <Text style={styles.noMatchesTitle}>No matches this session</Text>
          <Text style={styles.noMatchesText}>
            No restaurant was liked by everyone. Try again with different
            preferences!
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatchCard}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
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
  headerSection: {
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  separator: {
    height: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    ...shadow(0, 2, 6, 0.08),
  },
  cardImage: {
    width: '100%',
    height: 180,
  },
  cardImagePlaceholder: {
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#aaa',
    fontSize: 15,
  },
  cardBody: {
    padding: 14,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingStar: {
    fontSize: 15,
    color: '#FF6B35',
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  priceLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2a9d2a',
  },
  reviewCount: {
    fontSize: 13,
    color: '#888',
  },
  categories: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
    lineHeight: 18,
  },
  mapsButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  mapsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  noMatches: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noMatchesIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  noMatchesTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  noMatchesText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: '#f8f8f8',
  },
  homeButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
