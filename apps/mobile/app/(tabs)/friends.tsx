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
      const [friendsData, requestsData] = await Promise.all([
        apiGet<FriendWithProfile[]>('/api/friends'),
        apiGet<FriendWithProfile[]>('/api/friends/requests'),
      ]);
      setFriends(friendsData ?? []);
      setRequests(requestsData ?? []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load friends');
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
      // Remove from search results so they can't send again
      setSearchResults(prev => prev.filter(p => p.username !== username));
    } catch (err: any) {
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
      Alert.alert(
        action === 'accept' ? 'Friend Added!' : 'Request Declined',
        action === 'accept' ? 'You are now friends!' : 'Friend request declined.',
      );
      await loadFriends();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to respond');
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

  const sections = [
    ...(requests.length > 0 ? [{ title: 'Pending Requests', data: requests, type: 'request' as const }] : []),
    { title: 'Friends', data: friends, type: 'friend' as const },
  ];

  const showSearchResults = searchQuery.length >= 2;

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users by username..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching ? (
          <ActivityIndicator size="small" color="#FF6B35" />
        ) : searchQuery.length > 0 ? (
          <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear</Text>
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
              <Text style={styles.emptyText}>No users found for "{searchQuery}"</Text>
              <Text style={styles.hintText}>Make sure the username is spelled correctly</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <FriendCard
                  profile={item}
                  action={{
                    label: sendingTo === item.username ? 'Sending...' : 'Add',
                    onPress: () => sendRequest(item.username),
                    disabled: sendingTo !== null,
                  }}
                />
              )}
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                <Text style={styles.resultCount}>
                  {searchResults.length} user{searchResults.length !== 1 ? 's' : ''} found
                </Text>
              }
            />
          )}
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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              {section.type === 'request' && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{section.data.length}</Text>
                </View>
              )}
            </View>
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
            ) : (
              <FriendCard profile={item.profile} />
            )
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyText}>Search for users above to add friends!</Text>
            </View>
          }
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
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
    marginRight: 8,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearBtnText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  resultCount: {
    fontSize: 13,
    color: '#888',
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
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
  },
});
