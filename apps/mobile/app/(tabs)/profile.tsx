import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Image, ActivityIndicator, Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { apiPut } from '../../lib/api';
import { supabase } from '../../lib/supabase';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile?.display_name]);

  const initial = (displayName || profile?.username || '?')[0].toUpperCase();
  const hasChanges = displayName.trim() !== (profile?.display_name ?? '');

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const uri = asset.uri;
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${user!.id}/avatar.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { contentType: asset.mimeType ?? `image/${ext}`, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      await apiPut('/api/profile', { avatar_url: avatarUrl });
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Display name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await apiPut('/api/profile', { display_name: trimmed });
      await refreshProfile();
      Alert.alert('Success', 'Display name updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update display name.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to sign out.');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrap}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          {uploadingAvatar ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <View style={styles.editBadge}>
              <Text style={styles.editBadgeText}>✎</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.profileName}>{profile?.display_name ?? profile?.username ?? ''}</Text>
        <Text style={styles.profileUsername}>@{profile?.username ?? ''}</Text>
      </View>

      {/* Account */}
      <Text style={styles.groupLabel}>ACCOUNT</Text>
      <View style={styles.group}>
        <View style={styles.groupRow}>
          <View style={styles.groupRowContent}>
            <Text style={styles.groupRowLabel}>Email</Text>
            <Text style={styles.groupRowValue}>{user?.email ?? '—'}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        <View style={styles.groupDivider} />
        <View style={styles.groupRow}>
          <View style={styles.groupRowContent}>
            <Text style={styles.groupRowLabel}>Display Name</Text>
            <TextInput
              style={styles.inlineInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter display name"
              placeholderTextColor="#bbb"
              autoCapitalize="words"
              onBlur={() => { if (hasChanges) handleSave(); }}
            />
          </View>
          {hasChanges && (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? '...' : 'Save'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.groupDivider} />
        <View style={styles.groupRow}>
          <View style={styles.groupRowContent}>
            <Text style={styles.groupRowLabel}>Username</Text>
            <Text style={styles.groupRowValue}>@{profile?.username ?? '—'}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>

      {/* Preferences */}
      <Text style={styles.groupLabel}>PREFERENCES</Text>
      <View style={styles.group}>
        <View style={styles.groupRow}>
          <Text style={styles.groupRowLabel}>Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#e0e0e0', true: '#FF6B35' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Privacy & Security */}
      <Text style={styles.groupLabel}>PRIVACY & SECURITY</Text>
      <View style={styles.group}>
        <TouchableOpacity
          style={styles.groupRow}
          onPress={() => router.push('/(auth)/reset-password')}
          activeOpacity={0.7}
        >
          <Text style={styles.groupRowLabel}>Change Password</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <Text style={styles.groupLabel}>ABOUT</Text>
      <View style={styles.group}>
        <View style={styles.groupRow}>
          <Text style={styles.groupRowLabel}>Version</Text>
          <Text style={styles.groupRowValue}>1.0.0</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.85}>
        <Text style={styles.signOutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  content: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 20,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#607D8B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editBadgeText: {
    color: '#fff',
    fontSize: 13,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  profileUsername: {
    fontSize: 14,
    color: '#888',
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  group: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupRowContent: {
    flex: 1,
  },
  groupRowLabel: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  groupRowValue: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  inlineInput: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
    padding: 0,
  },
  chevron: {
    fontSize: 20,
    color: '#ccc',
    marginLeft: 8,
  },
  groupDivider: {
    height: 1,
    backgroundColor: '#f5f5f5',
    marginLeft: 16,
  },
  saveBtn: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  signOutButton: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  signOutText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
});
