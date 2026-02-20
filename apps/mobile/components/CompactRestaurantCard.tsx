import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import type { PlaceBusinessDTO } from '@bitebuddy/shared';
import { shadow } from '../lib/shadows';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 16 padding each side + 16 gap

interface Props {
  restaurant: PlaceBusinessDTO;
}

export function CompactRestaurantCard({ restaurant }: Props) {
  const firstCategory = restaurant.categories?.[0]?.title;

  return (
    <View style={styles.card}>
      {restaurant.image_url ? (
        <Image source={{ uri: restaurant.image_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>No Photo</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
        <View style={styles.meta}>
          {restaurant.rating > 0 && (
            <Text style={styles.rating}>&#9733; {restaurant.rating.toFixed(1)}</Text>
          )}
          {restaurant.price && (
            <Text style={styles.price}>{restaurant.price}</Text>
          )}
        </View>
        {firstCategory && (
          <Text style={styles.category} numberOfLines={1}>{firstCategory}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    ...shadow(0, 1, 4, 0.08),
  },
  image: {
    width: '100%',
    height: CARD_WIDTH * 0.75,
    backgroundColor: '#e0e0e0',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
  info: {
    padding: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  rating: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
  price: {
    fontSize: 12,
    color: '#666',
  },
  category: {
    fontSize: 11,
    color: '#888',
  },
});
