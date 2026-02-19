import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { apiPut } from '../../lib/api';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

      // Fetch the image as a blob for upload
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase Storage (upsert to overwrite previous avatar)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: asset.mimeType ?? `image/${ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache-busting timestamp to force image refresh
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      // Save to profile via API
      await apiPut('/api/profile', { avatar_url: avatarUrl });

      // Refresh profile to update UI everywhere
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar}>
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
            <View style={styles.changePhotoTag}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Display Name (editable) */}
      <View style={styles.field}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Enter display name"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
        {hasChanges && (
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Username (read-only) */}
      <View style={styles.field}>
        <Text style={styles.label}>Username</Text>
        <Text style={styles.readOnly}>@{profile?.username ?? '—'}</Text>
      </View>

      {/* Email (read-only) */}
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.readOnly}>{user?.email ?? '—'}</Text>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  avatarContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoTag: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  changePhotoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  field: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  readOnly: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  signOutButton: {
    marginTop: 24,
    width: '100%',
    backgroundColor: '#DC3545',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
