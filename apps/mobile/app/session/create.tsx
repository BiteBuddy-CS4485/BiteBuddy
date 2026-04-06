import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { apiGet, apiPost } from '../../lib/api';
import { FriendCard } from '../../components/FriendCard';
import type { Session, FriendWithProfile } from '@bitebuddy/shared';

const PRICE_OPTIONS = ['$', '$$', '$$$', '$$$$'];
const QUICK_SUGGESTIONS = [
  { label: '🌮 Taco Tuesday', name: 'Taco Tuesday 🌮' },
  { label: '🍕 Pizza Party', name: 'Pizza Party 🍕' },
  { label: '🍜 Ramen Run', name: 'Ramen Run 🍜' },
  { label: '☕ Coffee Break', name: 'Coffee Break ☕' },
];

type Step = 'details' | 'invite' | 'review';

export default function CreateSessionScreen() {
  const router = useRouter();

  // Step 1
  const [name, setName] = useState('');
  const [priceFilter, setPriceFilter] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [radiusKm, setRadiusKm] = useState('5');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Step 2
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [friendSearch, setFriendSearch] = useState('');

  // Step 3 / result
  const [sessionId, setSessionId] = useState<string>('');
  const [inviteCode, setInviteCode] = useState<string>('');

  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setLocation({ lat: 32.7767, lng: -96.7970 })
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

  async function handleDetailsNext() {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a session name');
      return;
    }
    setLoading(true);
    try {
      const friendsData = await apiGet<FriendWithProfile[]>('/api/friends');
      setFriends(friendsData);
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
    setStep('invite');
  }

  async function handleCreate() {
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
      setInviteCode(session.invite_code ?? '');

      if (selectedFriends.size > 0) {
        try {
          await apiPost(`/api/sessions/${session.id}/invite`, {
            user_ids: Array.from(selectedFriends),
          });
        } catch (err: any) {
          Alert.alert('Note', `Session created but could not invite all friends: ${err.message}`);
        }
      }

      router.replace(`/session/${session.id}/lobby`);
    } catch (err: any) {
      console.error('handleCreate:', err);
    } finally {
      setLoading(false);
    }
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

  const stepNumber = step === 'details' ? 1 : step === 'invite' ? 2 : 3;
  const filteredFriends = friends.filter(f => {
    if (!friendSearch.trim()) return true;
    const q = friendSearch.toLowerCase();
    return (
      f.profile.display_name?.toLowerCase().includes(q) ||
      f.profile.username.toLowerCase().includes(q)
    );
  });
  const selectedFriendsList = friends.filter(f => selectedFriends.has(f.profile.id));
  const unselectedFriends = filteredFriends.filter(f => !selectedFriends.has(f.profile.id));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            if (step === 'details') router.back();
            else if (step === 'invite') setStep('details');
            else setStep('invite');
          }}
        >
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Session</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={styles.headerBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(stepNumber / 3) * 100}%` }]} />
      </View>
      <Text style={styles.stepLabel}>Step {stepNumber} of 3</Text>

      {/* STEP 1: Details */}
      {step === 'details' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Name Your Session</Text>
          <Text style={styles.stepSubtitle}>Give your group session a fun name</Text>

          <Text style={styles.fieldLabel}>SESSION NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Friday Night Out 🌙"
            placeholderTextColor="#bbb"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.suggestionLabel}>Quick suggestions:</Text>
          <View style={styles.suggestionsGrid}>
            {QUICK_SUGGESTIONS.map(s => (
              <TouchableOpacity
                key={s.name}
                style={styles.suggestionChip}
                onPress={() => setName(s.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionChipText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.prefsLabel}>PREFERENCES</Text>

          <View style={styles.prefRow}>
            <Text style={styles.prefRowLabel}>Search Radius</Text>
            <View style={styles.radiusRow}>
              {['1', '2', '5', '10'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.radiusChip, radiusKm === r && styles.radiusChipActive]}
                  onPress={() => setRadiusKm(r)}
                >
                  <Text style={[styles.radiusChipText, radiusKm === r && styles.radiusChipTextActive]}>
                    {r} mi
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.prefRow}>
            <Text style={styles.prefRowLabel}>Price Range</Text>
            <View style={styles.priceRow}>
              {PRICE_OPTIONS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priceChip, priceFilter.includes(p) && styles.priceChipActive]}
                  onPress={() => togglePrice(p)}
                >
                  <Text style={[styles.priceChipText, priceFilter.includes(p) && styles.priceChipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.prefRow}>
            <Text style={styles.prefRowLabel}>Cuisine Type</Text>
            <TextInput
              style={styles.prefInput}
              placeholder="e.g. Italian, Sushi, Mexican"
              placeholderTextColor="#bbb"
              value={category}
              onChangeText={setCategory}
              autoCapitalize="none"
            />
          </View>

          {!location && (
            <Text style={styles.locationWarning}>Getting your location...</Text>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* STEP 2: Invite Friends */}
      {step === 'invite' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Invite Friends</Text>
          <Text style={styles.stepSubtitle}>Who's joining?</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor="#bbb"
            value={friendSearch}
            onChangeText={setFriendSearch}
            autoCapitalize="none"
          />

          {selectedFriendsList.length > 0 && (
            <>
              <Text style={styles.inviteSectionLabel}>SELECTED ({selectedFriendsList.length})</Text>
              {selectedFriendsList.map(f => (
                <FriendCard
                  key={f.id}
                  profile={f.profile}
                  action={{
                    label: '✕',
                    onPress: () => toggleFriend(f.profile.id),
                    color: '#e0e0e0',
                  }}
                />
              ))}
            </>
          )}

          {unselectedFriends.length > 0 && (
            <>
              <Text style={styles.inviteSectionLabel}>YOUR FRIENDS</Text>
              {unselectedFriends.map(f => (
                <FriendCard
                  key={f.id}
                  profile={f.profile}
                  action={{
                    label: '+',
                    onPress: () => toggleFriend(f.profile.id),
                    color: '#e0e0e0',
                  }}
                />
              ))}
            </>
          )}

          {friends.length === 0 && (
            <Text style={styles.noFriendsText}>No friends to invite. You can skip this step.</Text>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* STEP 3: Review */}
      {step === 'review' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Ready?</Text>
          <Text style={styles.stepSubtitle}>Review your session details</Text>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewSessionName}>{name}</Text>
            <Text style={styles.reviewDetail}>
              {radiusKm} mi radius
              {priceFilter.length > 0 ? ` · ${priceFilter.join(', ')}` : ''}
            </Text>
            {category ? <Text style={styles.reviewDetail}>{category}</Text> : null}

            <View style={styles.reviewTagRow}>
              <View style={styles.reviewTag}>
                <Text style={styles.reviewTagText}>
                  {selectedFriends.size} friend{selectedFriends.size !== 1 ? 's' : ''} invited
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editTag}
                onPress={() => setStep('invite')}
              >
                <Text style={styles.editTagText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Participants preview */}
          <Text style={styles.participantsLabel}>PARTICIPANTS ({selectedFriends.size + 1})</Text>
          <View style={styles.participantRow}>
            <View style={styles.participantAvatar}>
              <Text style={styles.participantAvatarText}>Y</Text>
            </View>
            <View>
              <Text style={styles.participantName}>You (Host)</Text>
              <Text style={styles.participantStatus}>Ready</Text>
            </View>
          </View>
          {selectedFriendsList.map(f => (
            <View key={f.id} style={styles.participantRow}>
              <View style={styles.participantAvatar}>
                <Text style={styles.participantAvatarText}>
                  {f.profile.display_name?.charAt(0).toUpperCase() ?? '?'}
                </Text>
              </View>
              <View>
                <Text style={styles.participantName}>{f.profile.display_name}</Text>
                <Text style={styles.participantStatus}>Pending invite</Text>
              </View>
            </View>
          ))}

          <Text style={styles.reviewNote}>
            Friends will be notified and can join when ready.
          </Text>

          {!location && (
            <Text style={styles.locationWarning}>Still getting your location...</Text>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        {step === 'details' && (
          <TouchableOpacity
            style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
            onPress={handleDetailsNext}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.ctaBtnText}>Next: Invite Friends →</Text>
            }
          </TouchableOpacity>
        )}
        {step === 'invite' && (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => setStep('review')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>Next: Review →</Text>
          </TouchableOpacity>
        )}
        {step === 'review' && (
          <TouchableOpacity
            style={[styles.ctaBtn, (loading || !location) && styles.ctaBtnDisabled]}
            onPress={handleCreate}
            disabled={loading || !location}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.ctaBtnText}>Create Session</Text>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    fontSize: 18,
    color: '#555',
    lineHeight: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  stepLabel: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 20,
  },
  suggestionLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  suggestionChip: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionChipText: {
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  prefsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  prefRow: {
    marginBottom: 20,
  },
  prefRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#f5f5f5',
  },
  radiusChipActive: {
    backgroundColor: '#FFF0E8',
    borderColor: '#FF6B35',
  },
  radiusChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  radiusChipTextActive: {
    color: '#FF6B35',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priceChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#f5f5f5',
  },
  priceChipActive: {
    backgroundColor: '#FFF0E8',
    borderColor: '#FF6B35',
  },
  priceChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  priceChipTextActive: {
    color: '#FF6B35',
  },
  prefInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1a1a1a',
  },
  locationWarning: {
    fontSize: 13,
    color: '#f0ad4e',
    marginTop: 8,
  },
  // Step 2
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  inviteSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  noFriendsText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Step 3
  reviewCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#eee',
  },
  reviewSessionName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  reviewDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  reviewTagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  reviewTag: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  reviewTagText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  editTag: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  editTagText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  participantsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#607D8B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  participantStatus: {
    fontSize: 12,
    color: '#888',
  },
  reviewNote: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 16,
    textAlign: 'center',
  },
  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  ctaBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaBtnDisabled: {
    opacity: 0.5,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
