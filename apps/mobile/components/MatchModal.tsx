import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import type { SessionRestaurant } from '@bitebuddy/shared';
import { shadow } from '../lib/shadows';

interface Props {
  visible: boolean;
  restaurant: SessionRestaurant | null;
  onClose: () => void;
}

export function MatchModal({ visible, restaurant, onClose }: Props) {
  if (!restaurant) return null;

  const ratingDisplay = restaurant.rating != null ? restaurant.rating.toFixed(1) : null;

  function handleOpenMaps() {
    // Try yelp_url first; fall back to a Google Maps search
    if (restaurant!.yelp_url) {
      Linking.openURL(restaurant!.yelp_url);
    } else if (restaurant!.latitude != null && restaurant!.longitude != null) {
      const url = `https://www.google.com/maps/search/?api=1&query=${restaurant!.latitude},${restaurant!.longitude}`;
      Linking.openURL(url);
    } else if (restaurant!.address) {
      const encoded = encodeURIComponent(restaurant!.address);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
    }
  }

  const hasMapLink =
    restaurant.yelp_url != null ||
    (restaurant.latitude != null && restaurant.longitude != null) ||
    restaurant.address != null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Celebration Header */}
          <Text style={styles.celebration}>🎉</Text>
          <Text style={styles.title}>It's a Match!</Text>
          <Text style={styles.subtitle}>Everyone wants to eat here</Text>

          {/* Restaurant Photo */}
          {restaurant.image_url ? (
            <Image
              source={{ uri: restaurant.image_url }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.placeholderIcon}>🍽</Text>
            </View>
          )}

          {/* Restaurant Name */}
          <Text style={styles.name} numberOfLines={2}>
            {restaurant.name}
          </Text>

          {/* Rating & Price Row */}
          <View style={styles.detailsRow}>
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

          {/* Address */}
          {restaurant.address != null && (
            <Text style={styles.address} numberOfLines={2}>
              📍 {restaurant.address}
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            {hasMapLink && (
              <TouchableOpacity
                style={styles.mapsButton}
                onPress={handleOpenMaps}
                activeOpacity={0.8}
              >
                <Text style={styles.mapsButtonText}>View on Google Maps</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.dismissButtonText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    ...shadow(0, 8, 16, 0.25),
  },
  celebration: {
    fontSize: 48,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FF6B35',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    marginBottom: 16,
  },
  imagePlaceholder: {
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 40,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  starIcon: {
    fontSize: 17,
    color: '#FF6B35',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  reviewCount: {
    fontSize: 14,
    color: '#888',
  },
  priceChip: {
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B35',
  },
  address: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  mapsButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  mapsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dismissButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  dismissButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
