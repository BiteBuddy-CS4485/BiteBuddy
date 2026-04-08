import React from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SessionRestaurant } from '@bitebuddy/shared';

interface Props {
  restaurant: SessionRestaurant;
}

export function RestaurantCard({ restaurant }: Props) {
  const rating = restaurant.rating != null ? restaurant.rating.toFixed(1) : null;
  const firstCategory = Array.isArray(restaurant.categories)
    ? restaurant.categories.find((category) => typeof category?.title === 'string')?.title
    : null;

  const subtitle = [firstCategory, restaurant.address?.split(',')[0]].filter(Boolean).join(' · ');
  const distanceMeters = (restaurant as any).distance_meters;
  const distanceMiles = distanceMeters != null
    ? `${(distanceMeters / 1609.34).toFixed(1)} mi`
    : null;

  return (
    <View style={styles.card}>
      {restaurant.image_url ? (
        <ImageBackground source={{ uri: restaurant.image_url }} style={styles.image} imageStyle={styles.imageRadius}>
          <View style={styles.overlay} />
          <View style={styles.footer}>
            <Text style={styles.name} numberOfLines={2}>{restaurant.name}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle || 'Restaurant'}</Text>
            <View style={styles.metaRow}>
              {rating ? <Pill label={`★ ${rating}`} /> : null}
              {restaurant.price ? <Pill label={restaurant.price} /> : null}
              {distanceMiles ? <Pill label={`⌖ ${distanceMiles}`} /> : null}
            </View>
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.emptyImage}>
          <Image
            source={{ uri: 'https://dummyimage.com/900x900/e4e7ec/98a2b3&text=BiteBuddy' }}
            style={styles.image}
          />
          <View style={styles.footerStatic}>
            <Text style={styles.name}>{restaurant.name}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#5f69af',
    shadowColor: '#111827',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
    elevation: 6,
  },
  image: {
    width: '100%',
    height: 560,
    justifyContent: 'flex-end',
  },
  imageRadius: {
    borderRadius: 30,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19, 12, 41, 0.45)',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 50,
  },
  footerStatic: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
  },
  name: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 50,
    lineHeight: 54,
    letterSpacing: -0.7,
  },
  subtitle: {
    color: '#e5e7eb',
    marginTop: 6,
    fontSize: 25,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyImage: {
    width: '100%',
    height: 560,
    backgroundColor: '#667085',
  },
});
