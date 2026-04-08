import React from 'react';
import {
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SessionRestaurant } from '@bitebuddy/shared';

interface MatchMember {
  id: string;
  name: string;
}

interface Props {
  visible: boolean;
  restaurant: SessionRestaurant | null;
  members: MatchMember[];
  onClose: () => void;
}

export function MatchModal({ visible, restaurant, members, onClose }: Props) {
  if (!restaurant) return null;

  const selectedRestaurant = restaurant;

  function handleOpenMaps() {
    if (selectedRestaurant.yelp_url) {
      void Linking.openURL(selectedRestaurant.yelp_url);
      return;
    }

    if (selectedRestaurant.latitude != null && selectedRestaurant.longitude != null) {
      void Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${selectedRestaurant.latitude},${selectedRestaurant.longitude}`
      );
      return;
    }

    if (selectedRestaurant.address) {
      void Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedRestaurant.address)}`
      );
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>IT'S A MATCH!</Text>
          <View style={styles.burstWrap}>
            <Text style={styles.spark}>✦</Text>
            <Text style={styles.spark}>·</Text>
            <Ionicons name="navigate-outline" size={38} color="#ff6f70" style={styles.mainBurstIcon} />
            <Text style={styles.spark}>·</Text>
            <Text style={styles.spark}>✦</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
            <Text style={styles.restaurantMeta}>
              {restaurant.categories?.[0]?.title || 'Restaurant'} · {restaurant.address ? '0.8 mi' : 'Near you'}
            </Text>

            <View style={styles.metrics}>
              {restaurant.rating != null ? <Pill label={`★ ${restaurant.rating.toFixed(1)}`} /> : null}
              {restaurant.price ? <Pill label={restaurant.price} /> : null}
            </View>

            <View style={styles.separator} />
            <Text style={styles.agreedLabel}>ALL MEMBERS AGREED</Text>

            <View style={styles.membersRow}>
              {members.map((member) => (
                <View key={member.id} style={styles.memberItem}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{member.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
                </View>
              ))}
            </View>

            <View style={styles.separator} />
            <Text style={styles.savedText}>Match saved to history</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.directionButton}
              onPress={() => {
                handleOpenMaps();
                onClose();
              }}
            >
              <Text style={styles.directionButtonText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  overlay: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'flex-start',
  },
  container: {
    flex: 1,
    marginHorizontal: 10,
    paddingTop: 120,
    paddingBottom: 20,
  },
  title: {
    textAlign: 'center',
    color: '#101828',
    fontSize: 20,
    fontWeight: '800',
  },
  burstWrap: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  spark: {
    color: '#f4b400',
    fontSize: 14,
    fontWeight: '700',
  },
  mainBurstIcon: {
    transform: [{ rotate: '18deg' }],
  },
  card: {
    marginTop: 30,
    marginHorizontal: 0,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    padding: 14,
  },
  restaurantName: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 30,
  },
  restaurantMeta: {
    marginTop: 3,
    color: '#667085',
    fontSize: 20,
  },
  metrics: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderRadius: 16,
    backgroundColor: '#eceff3',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: {
    color: '#344054',
    fontWeight: '700',
    fontSize: 15,
  },
  separator: {
    height: 1,
    backgroundColor: '#d0d5dd',
    marginVertical: 12,
  },
  agreedLabel: {
    color: '#667085',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.8,
  },
  membersRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  memberItem: {
    alignItems: 'center',
    width: 68,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#b2bbc7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  memberName: {
    marginTop: 6,
    color: '#101828',
    fontSize: 13,
    fontWeight: '600',
  },
  savedText: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    marginTop: 16,
    marginHorizontal: 0,
    flexDirection: 'row',
    gap: 10,
  },
  doneButton: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: '#d7dce4',
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 17,
  },
  directionButton: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: '#ff6f70',
    paddingVertical: 12,
    alignItems: 'center',
  },
  directionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
});
