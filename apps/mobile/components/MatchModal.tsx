import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Linking,
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
          {/* Title */}
          <Text style={styles.title}>IT'S A MATCH!</Text>

          {/* Party popper */}
          <View style={styles.celebration}>
            <Text style={styles.celebrationIcon}>🎉</Text>
          </View>

          {/* Restaurant Card */}
          <View style={styles.restaurantCard}>
            {/* Placeholder (no image to avoid cost) */}
            <View style={styles.restaurantIconWrap}>
              <Text style={styles.restaurantIcon}>🍽</Text>
            </View>

            <Text style={styles.restaurantName} numberOfLines={2}>
              {restaurant.name}
            </Text>

            {(restaurant.categories?.[0]?.title || restaurant.address) && (
              <Text style={styles.restaurantAddress} numberOfLines={1}>
                {restaurant.categories?.[0]?.title
                  ? restaurant.categories[0].title
                  : restaurant.address ?? ''}
              </Text>
            )}

            <View style={styles.metaRow}>
              {ratingDisplay != null && (
                <View style={styles.metaBadge}>
                  <Text style={styles.metaBadgeText}>★ {ratingDisplay}</Text>
                </View>
              )}
              {restaurant.price != null && (
                <View style={styles.metaBadge}>
                  <Text style={styles.metaBadgeText}>{restaurant.price}</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Members agreed */}
            <Text style={styles.membersLabel}>ALL MEMBERS AGREED</Text>
            <View style={styles.membersRow}>
              {['J', 'A', 'M', 'P'].map((initial, i) => (
                <View key={i} style={styles.memberCircle}>
                  <Text style={styles.memberCircleText}>{initial}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.savedNote}>Match saved to history</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.dismissButtonText}>Done</Text>
            </TouchableOpacity>

            {hasMapLink && (
              <TouchableOpacity
                style={styles.mapsButton}
                onPress={handleOpenMaps}
                activeOpacity={0.8}
              >
                <Text style={styles.mapsButtonText}>Get Directions</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    ...shadow(0, 8, 16, 0.25),
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  celebration: {
    marginBottom: 12,
  },
  celebrationIcon: {
    fontSize: 52,
  },
  restaurantCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  restaurantIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  restaurantIcon: {
    fontSize: 32,
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 4,
  },
  restaurantAddress: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metaBadge: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  metaBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 14,
  },
  membersLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#aaa',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  membersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  memberCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#607D8B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCircleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  savedNote: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '700',
  },
  mapsButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
  mapsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
