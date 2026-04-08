import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost, joinSessionWithLocation } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { SessionDetails } from '@bitebuddy/shared';
import SessionMap from '../../../components/SessionMap';

export default function LobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [locationSubmitted, setLocationSubmitted] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  async function submitUserLocation() {
    try {
      const getCoordinates = async (): Promise<{ latitude: number; longitude: number }> => {
        if (Platform.OS === 'web') {
          return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation not supported'));
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (position) =>
                resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
              reject
            );
          });
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission denied');
        }
        const loc = await Location.getCurrentPositionAsync({});
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      };

      const { latitude, longitude } = await getCoordinates();
      await joinSessionWithLocation(id!, latitude, longitude);
      setLocationSubmitted(true);
      setUserLocation({ latitude, longitude });
    } catch (err: any) {
      if (err.message !== 'Location permission denied') {
        Alert.alert('Location Error', err.message || 'Failed to get location');
      }
    }
  }

  async function loadSession() {
    try {
      const data = await apiGet<SessionDetails>(`/api/sessions/${id}`);
      setSession(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSession();
    if (!locationSubmitted) {
      void submitUserLocation();
    }
  }, [id]);

  useEffect(() => {
    const channel = supabase
      .channel(`lobby-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_members',
          filter: `session_id=eq.${id}`,
        },
        () => {
          void loadSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'session_members',
          filter: `session_id=eq.${id}`,
        },
        () => {
          void loadSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).status === 'active' && !starting) {
            router.replace(`/session/${id}/swipe`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, starting]);

  async function handleStart() {
    setStarting(true);
    try {
      await apiPost(`/api/sessions/${id}/start`);
      router.replace(`/session/${id}/swipe`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setStarting(false);
    }
  }

  const isCreator = useMemo(
    () => session?.created_by === user?.id,
    [session?.created_by, user?.id]
  );

  if (loading || !session) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#ff6f70" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Setup</Text>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="settings-outline" size={24} color="#ff6f70" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sessionName}>{session.name || 'Session'}</Text>

        <Text style={styles.sectionLabel}>MAP</Text>
        <View style={styles.mapCard}>
          {userLocation ? (
            <SessionMap
              latitude={userLocation.latitude}
              longitude={userLocation.longitude}
              style={styles.map}
            />
          ) : (
            <View style={styles.mapFallback}>
              <ActivityIndicator color="#ff6f70" />
            </View>
          )}
          <View style={styles.mapPin}>
            <Ionicons name="radio-button-on" size={26} color="#ff6f70" />
          </View>
        </View>

        <Text style={styles.sectionLabel}>SESSION SETTINGS</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingCol}>
            <Text style={styles.settingLabel}>Radius</Text>
            <Text style={styles.settingValue}>
              {session.radius_meters ? `${(session.radius_meters / 1609.34).toFixed(1)} mi` : '1.5 mi'}
            </Text>
          </View>
          <View style={styles.settingCol}>
            <Text style={styles.settingLabel}>Price</Text>
            <Text style={styles.settingValue}>
              {Array.isArray(session.price_filter) && session.price_filter.length > 0
                ? `${session.price_filter[0]} - ${session.price_filter[session.price_filter.length - 1]}`
                : '$ - $$$'}
            </Text>
          </View>
          <View style={styles.settingCol}>
            <Text style={styles.settingLabel}>Category</Text>
            <Text style={styles.settingValue}>{session.category_filter || 'All'}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PARTICIPANTS ({session.members.length})</Text>
        {session.members.map((member, index) => {
          const displayName = member.profile?.display_name || member.profile?.username || `User ${index + 1}`;
          const isHost = member.user_id === session.created_by;
          const isMe = member.user_id === user?.id;
          const joined = !(member as any).invited;
          const status = joined ? 'Ready' : 'Pending';

          return (
            <View key={member.id} style={styles.memberCard}>
              {member.profile?.avatar_url ? (
                <Image source={{ uri: member.profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.memberMeta}>
                <Text style={styles.memberName}>{displayName}{isMe ? ' (You)' : ''}</Text>
                <Text style={styles.memberRole}>{isHost ? 'Host' : joined ? 'Joined' : 'Invited'}</Text>
              </View>

              <View style={[styles.memberPill, joined ? styles.readyPill : styles.pendingPill]}>
                <Text style={[styles.memberPillText, joined ? styles.readyPillText : styles.pendingPillText]}>
                  {status}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.bottomBar}>
        {isCreator ? (
          <TouchableOpacity style={styles.startButton} onPress={handleStart} disabled={starting}>
            <Text style={styles.startButtonText}>{starting ? 'Starting...' : 'Start Swiping →'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingText}>Waiting for host to start...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  header: {
    height: 94,
    backgroundColor: '#f8fafb',
    borderBottomColor: '#e9edf1',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaecf0',
  },
  headerTitle: {
    color: '#101828',
    fontSize: 22,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 130,
  },
  sessionName: {
    color: '#101828',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    marginBottom: 12,
  },
  sectionLabel: {
    marginBottom: 10,
    fontSize: 13,
    letterSpacing: 0.9,
    color: '#667085',
    fontWeight: '700',
  },
  mapCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#c2ebd0',
    marginBottom: 22,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: 160,
  },
  mapFallback: {
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPin: {
    position: 'absolute',
    top: 64,
    left: '50%',
    marginLeft: -13,
  },
  settingsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 22,
  },
  settingCol: {
    flex: 1,
    alignItems: 'center',
  },
  settingLabel: {
    color: '#667085',
    fontSize: 13,
    marginBottom: 4,
  },
  settingValue: {
    color: '#101828',
    fontSize: 18,
    fontWeight: '700',
  },
  memberCard: {
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6b7788',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 22,
  },
  memberMeta: {
    flex: 1,
  },
  memberName: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 18,
  },
  memberRole: {
    marginTop: 2,
    color: '#667085',
    fontSize: 14,
  },
  memberPill: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  memberPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  readyPill: {
    backgroundColor: '#d9f3e3',
  },
  readyPillText: {
    color: '#0f8a40',
  },
  pendingPill: {
    backgroundColor: '#eaecf0',
  },
  pendingPillText: {
    color: '#667085',
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  startButton: {
    backgroundColor: '#ff7b67',
    borderRadius: 30,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#7d4b3b',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 5,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 30,
    lineHeight: 34,
  },
  waitingCard: {
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  waitingText: {
    color: '#667085',
    fontSize: 16,
    fontWeight: '600',
  },
});
