import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Profile } from '@bitebuddy/shared';
import { shadow } from '../lib/shadows';

interface ActionProps {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}

interface Props {
  profile: Profile;
  action?: ActionProps;
  secondaryAction?: ActionProps;
  statusLabel?: string;
}

export function FriendCard({ profile, action, secondaryAction, statusLabel }: Props) {
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
        {statusLabel && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        )}
        {secondaryAction && (
          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: secondaryAction.color ?? '#e0e0e0' },
              secondaryAction.disabled && styles.btnDisabled,
            ]}
            onPress={secondaryAction.onPress}
            disabled={secondaryAction.disabled}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, { color: secondaryAction.color ? '#fff' : '#333' }]}>
              {secondaryAction.label}
            </Text>
          </TouchableOpacity>
        )}
        {action && (
          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: action.color ?? '#FF6B35' },
              action.disabled && styles.btnDisabled,
            ]}
            onPress={action.onPress}
            disabled={action.disabled}
            activeOpacity={0.7}
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
    ...shadow(0, 1, 3, 0.06),
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
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
});
