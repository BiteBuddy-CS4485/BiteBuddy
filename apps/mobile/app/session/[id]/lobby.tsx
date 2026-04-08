import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image, Share, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { apiGet, apiPost, apiDelete, joinSessionWithLocation } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { SessionDetails } from '@bitebuddy/shared';

interface UserLocation { lat: number; lng: number; timestamp: string; }

function LobbyMap({
  userLocations,
  radiusMeters,
}: {
  userLocations: Record<string, UserLocation>;
  radiusMeters: number;
}) {
  const locs = Object.values(userLocations).filter(l => l && typeof l.lat === 'number' && typeof l.lng === 'number');
  if (locs.length === 0) return null;

  const centLat = locs.reduce((s, l) => s + l.lat, 0) / locs.length;
  const centLng = locs.reduce((s, l) => s + l.lng, 0) / locs.length;

  const markersJS = locs
    .map(l =>
      `L.circleMarker([${l.lat},${l.lng}],{radius:6,color:'#FF6B35',fillColor:'#FF6B35',fillOpacity:0.85,weight:2}).addTo(map);`
    )
    .join('\n');

  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#f0efe9;}</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${centLat},${centLng}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var circle=L.circle([${centLat},${centLng}],{
  radius:${radiusMeters},
  color:'#FF6B35',fillColor:'#FF6B35',fillOpacity:0.12,weight:2
}).addTo(map);
L.circleMarker([${centLat},${centLng}],{radius:8,color:'#FF6B35',fillColor:'#fff',fillOpacity:1,weight:3}).addTo(map);
${markersJS}
map.fitBounds(circle.getBounds(),{padding:[24,24]});
</script></body></html>`;

  if (Platform.OS === 'web') {
    // On web, use a native iframe — react-native-webview on web can
    // block external CDN resources due to iframe sandboxing.
    return (
      <View style={lobbyMapStyles.container}>
        {/* @ts-ignore — iframe is a valid DOM element on web */}
        <iframe
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Session map"
        />
      </View>
    );
  }

  return (
    <View style={lobbyMapStyles.container}>
      <WebView
        source={{ html }}
        style={lobbyMapStyles.webview}
        scrollEnabled={false}
        originWhitelist={['*']}
      />
    </View>
  );
}

const lobbyMapStyles = StyleSheet.create({
  container: {
    height: 200,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  webview: { flex: 1 },
});

export default function LobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [confirming, setConfirming] = useState<'cancel' | 'leave' | null>(null);
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState('');
  const [locationSubmitted, setLocationSubmitted] = useState(false);

  async function submitUserLocation() {
    try {
      const getCoordinates = async (): Promise<{ latitude: number; longitude: number }> => {
        if (Platform.OS === 'web') {
          return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                reject
              );
            } else {
              reject(new Error('Geolocation not supported'));
            }
          });
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') throw new Error('Location permission denied');
          const loc = await Location.getCurrentPositionAsync({});
          return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
      };

      const { latitude, longitude } = await getCoordinates();
      await joinSessionWithLocation(id!, latitude, longitude);
      setLocationSubmitted(true);
      await loadSession();
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
      console.error('loadSession:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
    if (!locationSubmitted) {
      submitUserLocation();
    }
  }, [id]);

  useEffect(() => {
    const channel = supabase
      .channel(`lobby-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'session_members',
        filter: `session_id=eq.${id}`,
      }, () => { loadSession(); })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `id=eq.${id}`,
      }, (payload) => {
        const status = (payload.new as any)?.status;
        if (status === 'active') {
          router.replace(`/session/${id}/swipe`);
        } else if (status === 'cancelled') {
          Alert.alert('Session Cancelled', 'The host has cancelled this session.');
          router.replace('/(tabs)');
        } else {
          loadSession();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function handleShare() {
    if (!session?.invite_code) return;
    try {
      await Share.share({
        message: `Join my BiteBuddy session "${session.name}"!\nUse invite code: ${session.invite_code}`,
      });
    } catch { /* dismissed */ }
  }

  async function confirmAction() {
    setActioning(true);
    setActionError('');
    try {
      if (confirming === 'cancel') {
        await apiPost(`/api/sessions/${id}/cancel`);
      } else {
        await apiDelete(`/api/sessions/${id}/leave`);
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      setActionError(err.message ?? 'Something went wrong');
    } finally {
      setActioning(false);
    }
  }

  async function handleStart() {
    setStarting(true);
    try {
      await apiPost(`/api/sessions/${id}/start`);
      // Discover restaurants based on all users' locations before navigating
      try {
        await apiPost(`/api/sessions/${id}/discover`, {
          search_radius: session?.radius_meters ? session.radius_meters / 1000 : 1,
          dietary_restrictions: [],
          preferences: {},
        });
      } catch (err) {
        console.warn('Failed to auto-discover restaurants:', err);
        // Don't fail the session start if discovery fails
      }
      router.replace(`/session/${id}/swipe`);
    } catch (err: any) {
      console.error('handleStart:', err);
      setStarting(false);
    }
  }

  if (loading || !session) {
    return <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />;
  }

  const isCreator = session.created_by === user?.id;
  const radiusMi = session.radius_meters ? (session.radius_meters / 1609).toFixed(1) : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Setup</Text>
        <TouchableOpacity style={styles.headerIconBtn} onPress={handleShare}>
          <Text style={styles.headerIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={session.members}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <>
            <Text style={styles.sessionName}>{session.name}</Text>

            {/* Session Settings */}
            {(radiusMi || session.price_filter || session.category_filter) && (
              <>
                <Text style={styles.sectionLabel}>SESSION SETTINGS</Text>
                <View style={styles.settingsCard}>
                  {radiusMi && (
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Radius</Text>
                      <Text style={styles.settingValue}>{radiusMi} mi</Text>
                    </View>
                  )}
                  {session.price_filter && session.price_filter.length > 0 && (
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Price</Text>
                      <Text style={styles.settingValue}>{session.price_filter.join(' - ')}</Text>
                    </View>
                  )}
                  {session.category_filter && (
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>Category</Text>
                      <Text style={styles.settingValue}>{session.category_filter}</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Location map */}
            {session.user_locations && Object.keys(session.user_locations).length > 0 && (session.radius_meters ?? 0) > 0 && (
              <LobbyMap
                userLocations={session.user_locations as Record<string, UserLocation>}
                radiusMeters={session.radius_meters}
              />
            )}

            {/* Invite code */}
            {session.invite_code && (
              <TouchableOpacity style={styles.inviteBox} onPress={handleShare} activeOpacity={0.7}>
                <Text style={styles.inviteLabel}>INVITE CODE</Text>
                <Text style={styles.inviteCode}>{session.invite_code}</Text>
                <Text style={styles.inviteHint}>Tap to share</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sectionLabel}>
              PARTICIPANTS ({session.members.length})
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const isHost = item.user_id === session.created_by;
          const initial = (item.profile?.display_name ?? '?').charAt(0).toUpperCase();
          return (
            <View style={styles.memberRow}>
              {item.profile?.avatar_url ? (
                <Image source={{ uri: item.profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.profile?.display_name ?? 'Unknown'}</Text>
                <Text style={styles.memberUsername}>
                  {isHost ? 'Host' : 'Joined'}
                </Text>
              </View>
              <View style={[styles.statusBadge, isHost ? styles.statusBadgeReady : styles.statusBadgePending]}>
                <Text style={[styles.statusBadgeText, isHost ? styles.statusBadgeTextReady : styles.statusBadgeTextPending]}>
                  {isHost ? 'Ready' : 'Ready'}
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        style={styles.memberList}
      />

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        {confirming ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              {confirming === 'cancel' ? 'End the session for everyone?' : 'Leave this session?'}
            </Text>
            {actionError ? <Text style={styles.confirmError}>{actionError}</Text> : null}
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={styles.confirmNo}
                onPress={() => { setConfirming(null); setActionError(''); }}
                disabled={actioning}
              >
                <Text style={styles.confirmNoText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmYes} onPress={confirmAction} disabled={actioning}>
                {actioning
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmYesText}>
                      {confirming === 'cancel' ? 'Cancel Session' : 'Leave'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : isCreator ? (
          <>
            <TouchableOpacity
              style={[styles.startButton, starting && styles.buttonDisabled]}
              onPress={handleStart}
              disabled={starting}
            >
              {starting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.startButtonText}>Start Swiping →</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.destructiveBtn} onPress={() => setConfirming('cancel')}>
              <Text style={styles.destructiveBtnText}>Cancel Session</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.waitingBar}>
              <Text style={styles.waitingText}>Waiting for the host to start...</Text>
            </View>
            <TouchableOpacity style={styles.destructiveBtn} onPress={() => setConfirming('leave')}>
              <Text style={styles.destructiveBtnText}>Leave Session</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 18, color: '#555', lineHeight: 20 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF0E8', alignItems: 'center', justifyContent: 'center',
  },
  headerIcon: { fontSize: 18 },
  sessionName: {
    fontSize: 24, fontWeight: '800', color: '#1a1a1a',
    paddingHorizontal: 20, marginTop: 20, marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 0.8,
    paddingHorizontal: 20, marginBottom: 8,
  },
  settingsCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 14,
    gap: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  settingItem: { alignItems: 'center', flex: 1 },
  settingLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  settingValue: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  inviteBox: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFF0E8',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    padding: 16,
    alignItems: 'center',
  },
  inviteLabel: { fontSize: 11, fontWeight: '700', color: '#FF6B35', letterSpacing: 1.5, marginBottom: 6 },
  inviteCode: { fontSize: 32, fontWeight: '800', color: '#1a1a1a', letterSpacing: 6 },
  inviteHint: { fontSize: 12, color: '#FF6B35', marginTop: 6 },
  list: { paddingHorizontal: 20, paddingBottom: 16 },
  memberList: { flex: 1 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#607D8B', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  memberUsername: { fontSize: 13, color: '#888' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeReady: { backgroundColor: '#E8F5E9' },
  statusBadgePending: { backgroundColor: '#f5f5f5' },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  statusBadgeTextReady: { color: '#2E7D32' },
  statusBadgeTextPending: { color: '#888' },
  bottomBar: {
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, gap: 8,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  startButton: {
    backgroundColor: '#FF6B35', borderRadius: 28, padding: 18, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  startButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  waitingBar: {
    backgroundColor: '#f5f5f5', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  waitingText: { color: '#888', fontSize: 15, fontWeight: '500' },
  destructiveBtn: { borderRadius: 14, padding: 14, alignItems: 'center' },
  destructiveBtnText: { color: '#e53935', fontSize: 15, fontWeight: '600' },
  confirmBox: {
    backgroundColor: '#fff3f3', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#ffcdd2',
  },
  confirmError: { fontSize: 13, color: '#e53935', textAlign: 'center', marginBottom: 8 },
  confirmText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', textAlign: 'center', marginBottom: 12 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  confirmNo: {
    flex: 1, backgroundColor: '#f0f0f0', borderRadius: 10, padding: 12, alignItems: 'center',
  },
  confirmNoText: { fontSize: 15, fontWeight: '600', color: '#555' },
  confirmYes: {
    flex: 1, backgroundColor: '#e53935', borderRadius: 10, padding: 12, alignItems: 'center',
  },
  confirmYesText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
