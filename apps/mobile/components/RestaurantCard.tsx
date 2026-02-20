import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import type { SessionRestaurant } from '@bitebuddy/shared';
import { shadow } from '../lib/shadows';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  restaurant: SessionRestaurant;
}

export function RestaurantCard({ restaurant }: Props) {
  const ratingDisplay = restaurant.rating != null ? restaurant.rating.toFixed(1) : null;

  return (
    <View style={styles.card}>
      {/* Restaurant Photo */}
      {restaurant.image_url ? (
        <Image
          source={{ uri: restaurant.image_url }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderIcon}>🍽</Text>
          <Text style={styles.placeholderText}>No Photo Available</Text>
        </View>
      )}

      {/* Info Section */}
      <View style={styles.info}>
        {/* Restaurant Name */}
        <Text style={styles.name} numberOfLines={2}>
          {restaurant.name}
        </Text>

        {/* Rating Row */}
        <View style={styles.ratingRow}>
          {ratingDisplay != null && (
            <View style={styles.ratingBadge}>
              <Text style={styles.starIcon}>★</Text>
              <Text style={styles.ratingText}>{ratingDisplay}</Text>
            </View>
          )}
          {restaurant.review_count != null && (
            <Text style={styles.reviewCount}>
              ({restaurant.review_count.toLocaleString()} reviews)
            </Text>
          )}
          {restaurant.price != null && (
            <View style={styles.priceChip}>
              <Text style={styles.priceText}>{restaurant.price}</Text>
            </View>
          )}
        </View>

        {/* Category Chips */}
        {restaurant.categories != null && restaurant.categories.length > 0 && (
          <View style={styles.categoriesRow}>
            {restaurant.categories.map((cat, index) => (
              <View key={`${cat.alias}-${index}`} style={styles.categoryChip}>
                <Text style={styles.categoryText}>{cat.title}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Address */}
        {restaurant.address != null && (
          <View style={styles.addressRow}>
            <Text style={styles.pinIcon}>📍</Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {restaurant.address}
            </Text>
          </View>
        )}

        {/* Phone */}
        {restaurant.phone != null && restaurant.phone.length > 0 && (
          <View style={styles.phoneRow}>
            <Text style={styles.phoneIcon}>📞</Text>
            <Text style={styles.phoneText}>{restaurant.phone}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadow(0, 4, 12, 0.15),
    maxHeight: SCREEN_HEIGHT * 0.68,
  },
  image: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.35,
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '500',
  },
  info: {
    padding: 20,
    paddingTop: 16,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  starIcon: {
    fontSize: 18,
    color: '#FF6B35',
  },
  ratingText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  reviewCount: {
    fontSize: 14,
    color: '#888',
    fontWeight: '400',
  },
  priceChip: {
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginLeft: 4,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B35',
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  categoryChip: {
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  pinIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneIcon: {
    fontSize: 13,
  },
  phoneText: {
    fontSize: 14,
    color: '#666',
  },
});
