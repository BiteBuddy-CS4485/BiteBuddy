import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform, Modal,
  SafeAreaView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { apiGet, apiPost } from '../../lib/api';
import type { Session, FriendWithProfile } from '@bitebuddy/shared';

const PRICE_OPTIONS = ['$', '$$', '$$$', '$$$$'];

const QUICK_SUGGESTIONS = [
  { label: '🌮 Taco Tuesday', value: 'Taco Tuesday' },
  { label: '🍕 Pizza Party', value: 'Pizza Party' },
  { label: '🍜 Ramen Run', value: 'Ramen Run' },
  { label: '☕ Coffee Break', value: 'Coffee Break' },
];

const CUISINE_OPTIONS = [
  'All Cuisines',
  'American',
  'Italian',
  'Mexican',
  'Chinese',
  'Japanese',
  'Thai',
  'Indian',
  'Mediterranean',
  'Korean',
  'Vietnamese',
  'Greek',
  'French',
  'Spanish',
];

const DIETARY_OPTIONS = [
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Gluten-Free', value: 'gluten_free' },
  { label: 'Halal', value: 'halal' },
];

// Step indicator at the top
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepBarContainer}>
      <Text style={styles.stepLabel}>Step {current} of {total}</Text>
      <View style={styles.stepTrack}>
        <View style={[styles.stepFill, { width: `${(current / total) * 100}%` as any }]} />
      </View>
    </View>
  );
}

export default function CreateSessionScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [priceFilter, setPriceFilter] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState('All Cuisines');
  const [dietary, setDietary] = useState<string[]>([]);
  const [radiusMiles, setRadiusMiles] = useState(1.5);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'invite'>('form');
  const [sessionId, setSessionId] = useState<string>('');
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [friendSearch, setFriendSearch] = useState('');
  const [cuisineModalVisible, setCuisineModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setLocation({ lat: 32.7767, lng: -96.7970 }),
          );
        } else {
          setLocation({ lat: 32.7767, lng: -96.7970 });
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } else {
          setLocation({ lat: 32.7767, lng: -96.7970 });
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
      const radiusMeters = Math.round(radiusMiles * 1609.34);
      const session = await apiPost<Session>('/api/sessions', {
        name: name.trim(),
        latitude: location.lat,
        longitude: location.lng,
        radius_meters: radiusMeters,
        price_filter: priceFilter.length > 0 ? priceFilter : undefined,
        category_filter: cuisine !== 'All Cuisines' ? cuisine.toLowerCase() : undefined,
      });

      // Move forward as soon as session is created so a friends-fetch failure
      // does not make session creation look broken.
      setSessionId(session.id);
      setStep('invite');

      try {
        const friendsData = await apiGet<FriendWithProfile[]>('/api/friends');
        setFriends(friendsData ?? []);
      } catch {
        setFriends([]);
      }
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
      prev.includes(price) ? prev.filter(p => p !== price) : [...prev, price],
    );
  }

  function toggleDietary(val: string) {
    setDietary(prev =>
      prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val],
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

  const normalizedSearch = friendSearch.trim().toLowerCase();
  const visibleFriends = friends.filter(({ profile }) => {
    if (!normalizedSearch) return true;
    return (
      (profile.display_name ?? '').toLowerCase().includes(normalizedSearch) ||
      (profile.username ?? '').toLowerCase().includes(normalizedSearch)
    );
  });
  const selectedFriendList = visibleFriends.filter((friend) => selectedFriends.has(friend.profile.id));
  const availableFriendList = visibleFriends.filter((friend) => !selectedFriends.has(friend.profile.id));

  // ── Invite step ──────────────────────────────────────────────
  if (step === 'invite') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setStep('form')}>
            <Ionicons name="chevron-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Session</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color="#1a1a1a" />
          </TouchableOpacity>
        </View>
        <StepBar current={1} total={3} />

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionHeading}>Invite Friends</Text>
          <Text style={styles.sectionSubtitle}>Who’s joining?</Text>

          <View style={styles.friendSearchWrap}>
            <Ionicons name="square" size={12} color="#cfcfcf" />
            <TextInput
              value={friendSearch}
              onChangeText={setFriendSearch}
              placeholder="Search friends..."
              placeholderTextColor="#b1b1b1"
              style={styles.friendSearchInput}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.inviteSectionLabel}>SELECTED ({selectedFriends.size})</Text>
          <View style={styles.friendListCard}>
            {selectedFriendList.length === 0 ? (
              <Text style={styles.emptyInviteText}>No selected friends yet</Text>
            ) : (
              selectedFriendList.map(({ id, profile }) => (
                <View key={id} style={styles.friendRow}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {(profile.display_name || profile.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendMeta}>
                    <Text style={styles.friendName}>{profile.display_name || profile.username}</Text>
                    <Text style={styles.friendHandle}>@{profile.username}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleFriend(profile.id)}
                    style={styles.friendActionBtn}
                  >
                    <Ionicons name="close" size={16} color="#8f8f8f" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <Text style={styles.inviteSectionLabel}>YOUR FRIENDS</Text>
          <View style={styles.friendListCard}>
            {friends.length === 0 ? (
              <Text style={styles.emptyInviteText}>No friends to invite yet</Text>
            ) : availableFriendList.length === 0 ? (
              <Text style={styles.emptyInviteText}>No additional friends match your search</Text>
            ) : (
              availableFriendList.map(({ id, profile }) => (
                <View key={id} style={styles.friendRow}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {(profile.display_name || profile.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendMeta}>
                    <Text style={styles.friendName}>{profile.display_name || profile.username}</Text>
                    <Text style={styles.friendHandle}>@{profile.username}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleFriend(profile.id)}
                    style={styles.friendActionBtn}
                  >
                    <Ionicons name="add" size={16} color="#8f8f8f" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.nextBtn} onPress={handleInvite}>
            <Text style={styles.nextBtnText}>Next: Review →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 1: Session setup ─────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Session</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      {/* Step bar */}
      <StepBar current={1} total={3} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Session Name */}
        <Text style={styles.sectionHeading}>Name Your Session</Text>
        <Text style={styles.sectionSubtitle}>Give your group session a fun name</Text>

        <Text style={styles.fieldLabel}>SESSION NAME</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Friday Night Out 🌙"
          placeholderTextColor="#bbb"
          value={name}
          onChangeText={setName}
        />

        {/* Quick suggestions */}
        <Text style={styles.fieldLabel}>Quick suggestions:</Text>
        <View style={styles.suggestionsRow}>
          {QUICK_SUGGESTIONS.map(s => (
            <TouchableOpacity
              key={s.value}
              style={styles.suggestionChip}
              onPress={() => setName(s.value)}
            >
              <Text style={styles.suggestionChipText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preferences */}
        <Text style={styles.preferencesLabel}>PREFERENCES</Text>

        {/* Search Radius */}
        <View style={styles.radiusRow}>
          <Text style={styles.fieldLabel}>Search Radius</Text>
          <Text style={styles.radiusValue}>{radiusMiles.toFixed(1)} mi</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={25}
          step={0.5}
          value={radiusMiles}
          onValueChange={setRadiusMiles}
          minimumTrackTintColor="#1a1a1a"
          maximumTrackTintColor="#e0e0e0"
          thumbTintColor="#1a1a1a"
        />

        {/* Price Range */}
        <Text style={styles.fieldLabel}>Price Range</Text>
        <View style={styles.priceRow}>
          {PRICE_OPTIONS.map(p => {
            const active = priceFilter.includes(p);
            return (
              <TouchableOpacity
                key={p}
                style={[styles.priceBtn, active && styles.priceBtnActive]}
                onPress={() => togglePrice(p)}
              >
                <Text style={[styles.priceBtnText, active && styles.priceBtnTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cuisine Type */}
        <Text style={styles.fieldLabel}>Cuisine Type</Text>
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setCuisineModalVisible(true)}
        >
          <Text style={styles.dropdownBtnText}>{cuisine}</Text>
          <Ionicons name="chevron-down" size={18} color="#666" />
        </TouchableOpacity>

        {/* Dietary Restrictions */}
        <Text style={styles.fieldLabel}>Dietary Restrictions <Text style={styles.optional}>(Optional)</Text></Text>
        <View style={styles.dietaryGrid}>
          {DIETARY_OPTIONS.map(d => {
            const active = dietary.includes(d.value);
            return (
              <TouchableOpacity
                key={d.value}
                style={styles.dietaryItem}
                onPress={() => toggleDietary(d.value)}
              >
                <View style={[styles.dietaryCircle, active && styles.dietaryCircleActive]} />
                <Text style={[styles.dietaryLabel, active && styles.dietaryLabelActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!location && (
          <Text style={styles.locationWarning}>Getting your location…</Text>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.nextBtn, (loading || !location) && styles.nextBtnDisabled]}
          onPress={handleCreate}
          disabled={loading || !location}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>Next: Invite Friends →</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Cuisine picker modal */}
      <Modal
        visible={cuisineModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCuisineModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCuisineModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Cuisine Type</Text>
            <ScrollView>
              {CUISINE_OPTIONS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={styles.modalOption}
                  onPress={() => { setCuisine(c); setCuisineModalVisible(false); }}
                >
                  <Text style={[styles.modalOptionText, cuisine === c && styles.modalOptionActive]}>
                    {c}
                  </Text>
                  {cuisine === c && <Ionicons name="checkmark" size={18} color="#1a1a1a" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },

  // Step bar
  stepBarContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  stepLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  stepTrack: {
    height: 4,
    backgroundColor: '#e8e8e8',
    borderRadius: 2,
    overflow: 'hidden',
  },
  stepFill: {
    height: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 2,
  },

  // Scroll content
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },

  sectionHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 18,
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#aaa',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 18,
  },
  optional: {
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 11,
    color: '#bbb',
  },

  // Session name input
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#1a1a1a',
  },

  // Quick suggestions
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 0,
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
  },
  suggestionChipText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },

  // Preferences divider
  preferencesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#aaa',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  // Radius
  radiusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 0,
  },
  radiusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  slider: {
    width: '100%',
    height: 36,
    marginTop: -4,
  },

  // Price range
  priceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priceBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#f2f2f2',
  },
  priceBtnActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  priceBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#888',
  },
  priceBtnTextActive: {
    color: '#fff',
  },

  // Cuisine dropdown
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownBtnText: {
    fontSize: 15,
    color: '#1a1a1a',
  },

  // Dietary
  dietaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dietaryItem: {
    width: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  dietaryCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  dietaryCircleActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  dietaryLabel: {
    fontSize: 14,
    color: '#888',
  },
  dietaryLabelActive: {
    color: '#1a1a1a',
    fontWeight: '600',
  },

  locationWarning: {
    fontSize: 13,
    color: '#f0ad4e',
    marginTop: 16,
    textAlign: 'center',
  },

  // Bottom CTA
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  nextBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Cuisine modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#555',
  },
  modalOptionActive: {
    color: '#1a1a1a',
    fontWeight: '700',
  },

  // Invite step
  empty: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  friendSearchWrap: {
    borderWidth: 1,
    borderColor: '#c8c8c8',
    borderRadius: 24,
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  friendSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2d2d2d',
    fontStyle: 'italic',
  },
  inviteSectionLabel: {
    fontSize: 12,
    color: '#9f9f9f',
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 8,
    letterSpacing: 0.7,
  },
  friendListCard: {
    borderWidth: 1,
    borderColor: '#d2d2d2',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  friendRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  friendAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ececec',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  friendAvatarText: {
    color: '#8f8f8f',
    fontSize: 13,
    fontWeight: '600',
  },
  friendMeta: {
    flex: 1,
  },
  friendName: {
    fontSize: 21,
    color: '#2f2f2f',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
  },
  friendHandle: {
    fontSize: 14,
    color: '#9a9a9a',
    marginTop: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
  },
  friendActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#bababa',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyInviteText: {
    fontSize: 14,
    color: '#9f9f9f',
    textAlign: 'center',
    paddingVertical: 14,
  },
});
