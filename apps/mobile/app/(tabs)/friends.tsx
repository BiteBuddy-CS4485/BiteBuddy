import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost } from '../../lib/api';
import type { Profile, FriendWithProfile } from '@bitebuddy/shared';

function formatPresence(friend: FriendWithProfile): string {
  return friend.online || !!friend.active_session_id ? 'Online' : 'Offline';
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [requests, setRequests] = useState<FriendWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendWithProfile[]>([]);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [pendingUsernames, setPendingUsernames] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadFriends();
    }, [])
  );

  async function loadFriends() {
    try {
      const [friendsData, requestsData, sentData] = await Promise.all([
        apiGet<FriendWithProfile[]>('/api/friends'),
        apiGet<FriendWithProfile[]>('/api/friends/requests'),
        apiGet<FriendWithProfile[]>('/api/friends/requests/sent'),
      ]);
      setFriends(friendsData ?? []);
      setRequests(requestsData ?? []);
      setSentRequests(sentData ?? []);
      setPendingUsernames(new Set((sentData ?? []).map((item) => item.profile?.username).filter(Boolean)));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  }

  function onSearchChange(text: string) {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      void performSearch(text);
    }, 350);
  }

  async function performSearch(text: string) {
    try {
      const data = await apiGet<Profile[]>(`/api/friends/search?q=${encodeURIComponent(text)}`);
      setSearchResults(data ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
      setHasSearched(true);
    }
  }

  async function sendRequest(username: string) {
    if (sendingTo) return;
    setSendingTo(username);
    setPendingUsernames((prev) => {
      const next = new Set(prev);
      next.add(username);
      return next;
    });

    try {
      await apiPost('/api/friends/request', { username });
      await loadFriends();
    } catch (err: any) {
      setPendingUsernames((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
      Alert.alert('Could not send request', err.message || 'Something went wrong');
    } finally {
      setSendingTo(null);
    }
  }

  async function respondToRequest(friendshipId: string, action: 'accept' | 'decline') {
    if (respondingTo) return;
    setRespondingTo(friendshipId);
    try {
      await apiPost('/api/friends/respond', { friendship_id: friendshipId, action });
      await loadFriends();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to respond');
    } finally {
      setRespondingTo(null);
    }
  }

  const showSearchResults = searchQuery.length >= 2;
  const showEmptyState = !showSearchResults && friends.length === 0 && requests.length === 0;

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#ff6f70" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="add" size={28} color="#ff6f70" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={25} color="#98a2b3" />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search by username or name"
          placeholderTextColor="#98a2b3"
          autoCapitalize="none"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close" size={26} color="#98a2b3" />
          </TouchableOpacity>
        ) : null}
      </View>

      {showSearchResults ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>RESULTS FOR '{searchQuery.toUpperCase()}'</Text>
          {searching ? (
            <ActivityIndicator color="#ff6f70" style={{ marginTop: 16 }} />
          ) : searchResults.length === 0 && hasSearched ? (
            <Text style={styles.smallEmpty}>No users found.</Text>
          ) : (
            searchResults.map((profile) => {
              const isPending =
                pendingUsernames.has(profile.username) ||
                sentRequests.some((item) => item.profile.id === profile.id);
              return (
                <View key={profile.id} style={styles.friendCard}>
                  <Avatar label={profile.display_name || profile.username} />
                  <View style={styles.friendMeta}>
                    <Text style={styles.friendName}>{profile.display_name}</Text>
                    <Text style={styles.friendSub}>@{profile.username}</Text>
                  </View>

                  {isPending ? (
                    <View style={styles.pendingChip}>
                      <Text style={styles.pendingChipText}>Pending</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => sendRequest(profile.username)}
                      disabled={sendingTo === profile.username}
                    >
                      <Text style={styles.addButtonText}>{sendingTo === profile.username ? '...' : '+ Add'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      ) : showEmptyState ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="person-add-outline" size={44} color="#ff6f70" />
          </View>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptySubtitle}>Search by username to get started</Text>
          <TouchableOpacity
            style={styles.findButton}
            onPress={() => {
              setSearchQuery('');
              setHasSearched(false);
              setSearchResults([]);
              searchInputRef.current?.focus();
            }}
          >
            <Text style={styles.findButtonText}>Find Friends</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {requests.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>PENDING REQUESTS ({requests.length})</Text>
              {requests.map((request) => (
                <View key={request.id} style={styles.friendCard}>
                  <Avatar label={request.profile.display_name} />
                  <View style={styles.friendMeta}>
                    <Text style={styles.friendName}>{request.profile.display_name}</Text>
                    <Text style={styles.friendSub}>@{request.profile.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => respondToRequest(request.id, 'accept')}
                    disabled={respondingTo === request.id}
                  >
                    <Text style={styles.acceptButtonText}>{respondingTo === request.id ? '...' : 'Accept'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => respondToRequest(request.id, 'decline')}
                    disabled={respondingTo === request.id}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}

          <Text style={styles.sectionLabel}>MY FRIENDS ({friends.length})</Text>
          {friends.map((friend, index) => (
            <View key={friend.id} style={styles.friendCard}>
              <Avatar label={friend.profile.display_name || friend.profile.username}>
                <View style={[styles.statusDot, { backgroundColor: friend.online || friend.active_session_id ? '#14b858' : '#98a2b3' }]} />
              </Avatar>
              <View style={styles.friendMeta}>
                <Text style={styles.friendName}>{friend.profile.display_name}</Text>
                <Text style={styles.friendSub}>{formatPresence(friend)}</Text>
              </View>
              <Ionicons name="menu" size={30} color="#98a2b3" />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Avatar({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <View style={styles.avatarWrap}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{label.charAt(0).toUpperCase()}</Text>
      </View>
      {children}
    </View>
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginLeft: 38,
    color: '#101828',
    fontSize: 22,
    fontWeight: '800',
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe9ea',
  },
  searchWrap: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#344054',
    fontSize: 17,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sectionLabel: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#667085',
    letterSpacing: 0.8,
  },
  friendCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6b7788',
  },
  avatarText: {
    color: '#fff',
    fontSize: 33,
    fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderColor: '#fff',
    borderWidth: 2,
  },
  friendMeta: {
    flex: 1,
  },
  friendName: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 20,
  },
  friendSub: {
    color: '#667085',
    fontSize: 16,
    marginTop: 2,
  },
  acceptButton: {
    borderRadius: 18,
    backgroundColor: '#ff6f70',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  declineButton: {
    borderRadius: 18,
    backgroundColor: '#eaecf0',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  declineButtonText: {
    color: '#344054',
    fontWeight: '700',
    fontSize: 15,
  },
  addButton: {
    borderRadius: 18,
    backgroundColor: '#ff6f70',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  pendingChip: {
    borderRadius: 18,
    backgroundColor: '#eaecf0',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pendingChipText: {
    color: '#667085',
    fontWeight: '700',
    fontSize: 17,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: -90,
  },
  emptyIconCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe9ea',
  },
  emptyTitle: {
    marginTop: 24,
    color: '#101828',
    fontWeight: '800',
    fontSize: 49,
    lineHeight: 52,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 10,
    color: '#475467',
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  findButton: {
    marginTop: 26,
    borderRadius: 26,
    backgroundColor: '#ff815f',
    paddingHorizontal: 38,
    paddingVertical: 16,
    shadowColor: '#7d4b3b',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 5,
  },
  findButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 19,
  },
  smallEmpty: {
    marginTop: 16,
    color: '#667085',
    fontSize: 16,
  },
});
