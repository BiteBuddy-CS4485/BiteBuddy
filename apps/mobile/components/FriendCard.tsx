import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Profile } from '@bitebuddy/shared';

interface Props {
  profile: Profile;
  action?: {
    label: string;
    onPress: () => void;
    color?: string;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
    color?: string;
  };
}

export function FriendCard({ profile, action, secondaryAction }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {profile.display_name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
      </View>
      <View style={styles.actions}>
        {secondaryAction && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: secondaryAction.color ?? '#e0e0e0' }]}
            onPress={secondaryAction.onPress}
          >
            <Text style={[styles.btnText, { color: secondaryAction.color ? '#fff' : '#333' }]}>
              {secondaryAction.label}
            </Text>
          </TouchableOpacity>
        )}
        {action && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: action.color ?? '#FF6B35' }]}
            onPress={action.onPress}
          >
            <Text style={styles.btnText}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  username: {
    fontSize: 13,
    color: '#888',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
