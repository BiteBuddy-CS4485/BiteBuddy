import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  ActivityIndicator, Alert, SectionList,
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
  const [searching, setSearching] = useState(false);

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
      setFriends(friendsData);
      setRequests(requestsData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await apiGet<Profile[]>(`/api/friends/search?q=${encodeURIComponent(text)}`);
      setSearchResults(data);
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest(username: string) {
    try {
      await apiPost('/api/friends/request', { username });
      Alert.alert('Sent', `Friend request sent to @${username}`);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function respondToRequest(friendshipId: string, action: 'accept' | 'decline') {
    try {
      await apiPost('/api/friends/respond', { friendship_id: friendshipId, action });
      loadFriends();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  if (loading) {
    return <ActivityIndicator size="large" color="#FF6B35" style={styles.loader} />;
  }

  const sections = [
    ...(requests.length > 0 ? [{ title: 'Pending Requests', data: requests, type: 'request' as const }] : []),
    { title: 'Friends', data: friends, type: 'friend' as const },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users by username..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color="#FF6B35" />}
      </View>

      {searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <FriendCard
              profile={item}
              action={{ label: 'Add', onPress: () => sendRequest(item.username) }}
            />
          )}
          contentContainerStyle={styles.list}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, section }) =>
            section.type === 'request' ? (
              <FriendCard
                profile={item.profile}
                action={{
                  label: 'Accept',
                  onPress: () => respondToRequest(item.id, 'accept'),
                }}
                secondaryAction={{
                  label: 'Decline',
                  onPress: () => respondToRequest(item.id, 'decline'),
                  color: '#dc3545',
                }}
              />
            ) : (
              <FriendCard profile={item.profile} />
            )
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No friends yet. Search for users above!</Text>
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
  list: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
  },
});
