import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Session } from '@bitebuddy/shared';
import { shadow } from '../lib/shadows';

interface Props {
  session: Session;
  onPress: () => void;
  matchCount?: number;
}

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  waiting: { bg: '#FFF3E0', label: 'Waiting' },
  active: { bg: '#E8F5E9', label: 'Active' },
  completed: { bg: '#F5F5F5', label: 'Completed' },
};

const STATUS_TEXT_COLOR: Record<string, string> = {
  waiting: '#E65100',
  active: '#2E7D32',
  completed: '#757575',
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

export function SessionCard({ session, onPress, matchCount }: Props) {
  const config = STATUS_CONFIG[session.status] ?? { bg: '#F5F5F5', label: session.status };
  const textColor = STATUS_TEXT_COLOR[session.status] ?? '#757575';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{session.name}</Text>
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
          <Text style={[styles.badgeText, { color: textColor }]}>{config.label}</Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <Text style={styles.date}>{formatDate(session.created_at)}</Text>
        {matchCount !== undefined && (
          <View style={styles.matchInfo}>
            <Text style={styles.matchIcon}>&#9829;</Text>
            <Text style={styles.matchCount}>
              {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            </Text>
          </View>
        )}
      </View>

      {session.category_filter && (
        <View style={styles.categoryRow}>
          <Text style={styles.categoryLabel}>{session.category_filter}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    ...shadow(0, 1, 4, 0.08),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: '#888',
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchIcon: {
    fontSize: 13,
    color: '#FF6B35',
  },
  matchCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF6B35',
  },
  categoryRow: {
    marginTop: 8,
  },
  categoryLabel: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
});
