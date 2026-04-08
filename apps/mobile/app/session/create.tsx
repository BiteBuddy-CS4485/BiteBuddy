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

// Radius chip values are treated as km internally (multiply ×1000 for meters)
const RADIUS_OPTIONS = ['1', '2', '5', '10'];

type Step = 'details' | 'invite';

function RadiusMap({ radiusKm }: { radiusKm: string }) {
  const r = parseFloat(radiusKm) || 5;
  // Scale rings relative to max option (10)
  const scale = r / 10;
  const SIZE = 180;
  const center = SIZE / 2;

  return (
    <View style={mapStyles.wrapper}>
      <View style={[mapStyles.container, { width: SIZE, height: SIZE }]}>
        {/* Outer ring — full radius boundary */}
        <View style={[mapStyles.ring, { width: SIZE, height: SIZE, borderRadius: SIZE / 2, opacity: 0.15 }]} />
        {/* Mid ring */}
        <View style={[
          mapStyles.ring,
          {
            width: SIZE * scale,
            height: SIZE * scale,
            borderRadius: (SIZE * scale) / 2,
            opacity: 0.25,
          },
        ]} />
        {/* Inner filled circle */}
        <View style={[
          mapStyles.innerCircle,
          {
            width: SIZE * scale * 0.5,
            height: SIZE * scale * 0.5,
            borderRadius: (SIZE * scale * 0.5) / 2,
          },
        ]} />
        {/* Center dot = user */}
        <View style={mapStyles.centerDot} />
      </View>
      <Text style={mapStyles.label}>{r} mi search radius</Text>
      <Text style={mapStyles.sublabel}>Restaurants within this area will be shown</Text>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginVertical: 16,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  ring: {
    position: 'absolute',
    backgroundColor: '#FF6B35',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  innerCircle: {
    position: 'absolute',
    backgroundColor: '#FF6B35',
    opacity: 0.35,
  },
  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B35',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    zIndex: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  sublabel: {
    fontSize: 12,
    color: '#888',
  },
});

export default function CreateSessionScreen() {
  const router = useRouter();

  // Step 1 fields
  const [name, setName] = useState('');
  const [priceFilter, setPriceFilter] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [radiusKm, setRadiusKm] = useState('5');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Step 2 fields
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [friendSearch, setFriendSearch] = useState('');

  // Session result (set after creation)
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
        radius_meters: Math.round(parseFloat(radiusKm || '5') * 1609.34),
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
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create session');
      console.error('handleCreate:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!inviteCode) return;
    try {
      await Share.share({
        message: `Join my BiteBuddy session "${name}"!\nUse invite code: ${inviteCode}`,
      });
    } catch { /* dismissed */ }
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

  const stepNumber = step === 'details' ? 1 : 2;
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
            else if (!sessionId) setStep('details');
            // once session is created, back goes to lobby
            else router.replace(`/session/${sessionId}/lobby`);
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
        <View style={[styles.progressFill, { width: `${(stepNumber / 2) * 100}%` }]} />
      </View>
      <Text style={styles.stepLabel}>Step {stepNumber} of 2</Text>

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
              {RADIUS_OPTIONS.map(r => (
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

          {/* Radius visualization */}
          <RadiusMap radiusKm={radiusKm} />

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

      {/* STEP 2: Invite + (after creation) Invite Code */}
      {step === 'invite' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>
            {sessionId ? 'Session Created!' : 'Invite Friends'}
          </Text>
          <Text style={styles.stepSubtitle}>
            {sessionId ? 'Share the code below to invite friends' : 'Who\'s joining?'}
          </Text>

          {/* Invite code — shown after session creation */}
          {sessionId && inviteCode ? (
            <TouchableOpacity style={styles.inviteBox} onPress={handleShare} activeOpacity={0.7}>
              <Text style={styles.inviteLabel}>INVITE CODE</Text>
              <Text style={styles.inviteCode}>{inviteCode}</Text>
              <Text style={styles.inviteHint}>Tap to share</Text>
            </TouchableOpacity>
          ) : null}

          {/* Friends search + list */}
          {!sessionId && (
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              placeholderTextColor="#bbb"
              value={friendSearch}
              onChangeText={setFriendSearch}
              autoCapitalize="none"
            />
          )}

          {selectedFriendsList.length > 0 && (
            <>
              <Text style={styles.inviteSectionLabel}>
                {sessionId ? 'INVITED' : 'SELECTED'} ({selectedFriendsList.length})
              </Text>
              {selectedFriendsList.map(f => (
                <FriendCard
                  key={f.id}
                  profile={f.profile}
                  action={sessionId ? undefined : {
                    label: '✕',
                    onPress: () => toggleFriend(f.profile.id),
                    color: '#e0e0e0',
                  }}
                />
              ))}
            </>
          )}

          {!sessionId && unselectedFriends.length > 0 && (
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

          {!sessionId && friends.length === 0 && (
            <Text style={styles.noFriendsText}>No friends to invite. You can skip this step.</Text>
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
        {step === 'invite' && !sessionId && (
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
        {step === 'invite' && !!sessionId && (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.replace(`/session/${sessionId}/lobby`)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>Go to Lobby →</Text>
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
  // Step 2 — invite
  inviteBox: {
    marginBottom: 24,
    backgroundColor: '#FFF0E8',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    padding: 20,
    alignItems: 'center',
  },
  inviteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6B35',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 6,
    marginBottom: 6,
  },
  inviteHint: {
    fontSize: 12,
    color: '#FF6B35',
  },
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
