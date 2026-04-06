import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  ActivityIndicator, Alert, SectionList, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { apiGet, apiPost } from '../../lib/api';
import { FriendCard } from '../../components/FriendCard';
import type { Profile, FriendWithProfile } from '@bitebuddy/shared';

export default function FriendsScreen() {
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [requests, setRequests] = useState<FriendWithProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendWithProfile[]>([]);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
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
    } catch (err: any) {
      console.error('loadFriends:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadFriends();
  }

  function onSearchChange(text: string) {
    setSearchQuery(text);
    setSearchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      performSearch(text);
    }, 400);
  }

  async function performSearch(text: string) {
    try {
      const data = await apiGet<Profile[]>(`/api/friends/search?q=${encodeURIComponent(text)}`);
      setSearchResults(data ?? []);
      setHasSearched(true);
    } catch (err: any) {
      setSearchError(err.message || 'Search failed');
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest(username: string) {
    if (sendingTo) return;
    setSendingTo(username);
    try {
      await apiPost('/api/friends/request', { username });
      Alert.alert('Request Sent!', `Friend request sent to @${username}`);
      setSearchResults(prev => prev.filter(p => p.username !== username));
    } catch (err: any) {
      console.error('sendRequest:', err);
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
      console.error('respondToRequest:', err);
    } finally {
      setRespondingTo(null);
    }
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setSearchError('');
  }

  if (loading) {
    return <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />;
  }

  const showSearchResults = searchQuery.length >= 2;
  const sections = [
    ...(requests.length > 0 ? [{ title: `PENDING REQUESTS (${requests.length})`, data: requests, type: 'request' as const }] : []),
    ...(sentRequests.length > 0 ? [{ title: `SENT REQUESTS (${sentRequests.length})`, data: sentRequests, type: 'sent' as const }] : []),
    ...(friends.length > 0 ? [{ title: `MY FRIENDS (${friends.length})`, data: friends, type: 'friend' as const }] : []),
  ];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or name"
          placeholderTextColor="#bbb"
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching ? (
          <ActivityIndicator size="small" color="#FF6B35" />
        ) : searchQuery.length > 0 ? (
          <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {showSearchResults ? (
        // Search results view
        <View style={styles.flex1}>
          {searchError ? (
            <View style={styles.statusMessage}>
              <Text style={styles.errorText}>{searchError}</Text>
              <TouchableOpacity onPress={() => performSearch(searchQuery)} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : searching ? (
            <View style={styles.statusMessage}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.statusText}>Searching...</Text>
            </View>
          ) : searchResults.length === 0 && hasSearched ? (
            <View style={styles.statusMessage}>
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.hintText}>for "{searchQuery}"</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <FriendCard
                  profile={item}
                  action={{
                    label: sendingTo === item.username ? 'Sending...' : '+ Add',
                    onPress: () => sendRequest(item.username),
                    disabled: sendingTo !== null,
                  }}
                />
              )}
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                <Text style={styles.resultLabel}>
                  RESULTS FOR '{searchQuery.toUpperCase()}'
                </Text>
              }
            />
          )}
        </View>
      ) : friends.length === 0 && requests.length === 0 ? (
        // Empty state
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIconText}>👤+</Text>
          </View>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptyText}>Search by username to get started</Text>
          <TouchableOpacity
            style={styles.findFriendsBtn}
            onPress={() => {/* focus search */}}
            activeOpacity={0.85}
          >
            <Text style={styles.findFriendsBtnText}>Find Friends</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Friends & requests list
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, section }) =>
            section.type === 'request' ? (
              <FriendCard
                profile={item.profile}
                action={{
                  label: respondingTo === item.id ? '...' : 'Accept',
                  onPress: () => respondToRequest(item.id, 'accept'),
                  disabled: respondingTo !== null,
                }}
                secondaryAction={{
                  label: respondingTo === item.id ? '...' : 'Decline',
                  onPress: () => respondToRequest(item.id, 'decline'),
                  color: '#dc3545',
                  disabled: respondingTo !== null,
                }}
              />
            ) : section.type === 'sent' ? (
              <FriendCard profile={item.profile} statusLabel="Pending" />
            ) : (
              <FriendCard profile={item.profile} />
            )
          }
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  flex1: {
    flex: 1,
  },
  loader: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
    color: '#bbb',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    color: '#aaa',
    fontSize: 16,
  },
  list: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  statusMessage: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  errorText: {
    fontSize: 15,
    color: '#dc3545',
    textAlign: 'center',
  },
  hintText: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyIconText: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 8,
  },
  findFriendsBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  findFriendsBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
