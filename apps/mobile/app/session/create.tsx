import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { apiGet, apiPost } from '../../lib/api';
import { FriendCard } from '../../components/FriendCard';
import type { Session, FriendWithProfile } from '@bitebuddy/shared';

const PRICE_OPTIONS = ['$', '$$', '$$$', '$$$$'];

export default function CreateSessionScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [priceFilter, setPriceFilter] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [radiusKm, setRadiusKm] = useState('5');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'invite'>('form');
  const [sessionId, setSessionId] = useState<string>('');
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        // Use browser geolocation API on web
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => {
              // Fallback: use a default location (Dallas, TX) if denied
              setLocation({ lat: 32.7767, lng: -96.7970 });
            }
          );
        } else {
          setLocation({ lat: 32.7767, lng: -96.7970 });
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      }
    })();
  }, []);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a session name');
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Location not available. Please enable location services.');
      return;
    }
    setLoading(true);
    try {
      const session = await apiPost<Session>('/api/sessions', {
        name: name.trim(),
        latitude: location.lat,
        longitude: location.lng,
        radius_meters: Math.round(parseFloat(radiusKm || '5') * 1000),
        price_filter: priceFilter.length > 0 ? priceFilter : undefined,
        category_filter: category.trim() || undefined,
      });
      setSessionId(session.id);

      // Load friends for invite step
      const friendsData = await apiGet<FriendWithProfile[]>('/api/friends');
      setFriends(friendsData);
      setStep('invite');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (selectedFriends.size > 0) {
      try {
        const userIds = Array.from(selectedFriends);
        await apiPost(`/api/sessions/${sessionId}/invite`, { user_ids: userIds });
      } catch (err: any) {
        Alert.alert('Error', err.message);
      }
    }
    router.replace(`/session/${sessionId}/lobby`);
  }

  function togglePrice(price: string) {
    setPriceFilter(prev =>
      prev.includes(price) ? prev.filter(p => p !== price) : [...prev, price]
    );
  }

  function toggleFriend(userId: string) {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  if (step === 'invite') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Invite Friends</Text>
          <Text style={styles.subtitle}>Select friends to join your session</Text>

          {friends.length === 0 ? (
            <Text style={styles.empty}>No friends to invite. You can skip this step.</Text>
          ) : (
            friends.map(f => (
              <FriendCard
                key={f.id}
                profile={f.profile}
                action={{
                  label: selectedFriends.has(f.profile.id) ? 'Selected' : 'Invite',
                  onPress: () => toggleFriend(f.profile.id),
                  color: selectedFriends.has(f.profile.id) ? '#5cb85c' : '#FF6B35',
                }}
              />
            ))
          )}
        </ScrollView>

        <TouchableOpacity style={styles.button} onPress={handleInvite}>
          <Text style={styles.buttonText}>
            {selectedFriends.size > 0 ? `Invite ${selectedFriends.size} & Continue` : 'Skip & Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>New Session</Text>

        <Text style={styles.label}>Session Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Friday Dinner"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Price Range</Text>
        <View style={styles.chipRow}>
          {PRICE_OPTIONS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, priceFilter.includes(p) && styles.chipActive]}
              onPress={() => togglePrice(p)}
            >
              <Text style={[styles.chipText, priceFilter.includes(p) && styles.chipTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Category (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. italian, sushi, mexican"
          placeholderTextColor="#999"
          value={category}
          onChangeText={setCategory}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Search Radius (km)</Text>
        <TextInput
          style={styles.input}
          placeholder="5"
          placeholderTextColor="#999"
          value={radiusKm}
          onChangeText={setRadiusKm}
          keyboardType="numeric"
        />

        {!location && (
          <Text style={styles.locationWarning}>Getting your location...</Text>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.button, (loading || !location) && styles.buttonDisabled]}
        onPress={handleCreate}
        disabled={loading || !location}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Session</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    padding: 24,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  chipActive: {
    backgroundColor: '#FFF0E8',
    borderColor: '#FF6B35',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  chipTextActive: {
    color: '#FF6B35',
  },
  locationWarning: {
    fontSize: 13,
    color: '#f0ad4e',
    marginTop: 12,
  },
  empty: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  button: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
