import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');

  async function handleSignup() {
    setError('');
    if (!displayName || !email || !username || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the terms to continue');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, username.trim());
    } catch (err: any) {
      setError(err.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(auth)')}>
          <Ionicons name="arrow-back" size={26} color="#475569" />
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join BiteBuddy and start matching</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>DISPLAY NAME</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Jordan"
          placeholderTextColor="#8f8f8f"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <Text style={styles.label}>USERNAME</Text>
        <TextInput
          style={styles.input}
          placeholder="@yourname"
          placeholderTextColor="#8f8f8f"
          value={username}
          onChangeText={(value) => setUsername(value.replace('@', '').toLowerCase())}
          autoCapitalize="none"
        />

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#8f8f8f"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#8f8f8f"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>CONFIRM PASSWORD</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#8f8f8f"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.termsRow}
          activeOpacity={0.9}
          onPress={() => setAcceptedTerms((prev) => !prev)}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
            {acceptedTerms ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
          <Text style={styles.termsText}>
            I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating Account...' : 'Create Account →'}
          </Text>
        </TouchableOpacity>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>Already have an account? Sign in →</Text>
          </TouchableOpacity>
        </Link>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eaecf0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475467',
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667085',
    marginBottom: 6,
    marginTop: 7,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: '#eaecf0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 2,
    color: '#1a1a1a',
  },
  termsRow: {
    marginTop: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#bcc3cd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    borderColor: '#ff6f70',
    backgroundColor: '#ff6f70',
  },
  termsText: {
    flex: 1,
    color: '#475467',
    fontSize: 11,
    lineHeight: 14,
  },
  termsLink: {
    color: '#ff6f70',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#ff766a',
    borderRadius: 30,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
    shadowColor: '#9a5c4a',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    marginTop: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#98a2b3',
    paddingTop: 6,
    alignSelf: 'center',
    minWidth: 220,
  },
  linkText: {
    fontSize: 12,
    color: '#475467',
    textDecorationLine: 'underline',
  },
  errorBox: {
    backgroundColor: '#fee4e2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    fontWeight: '500',
  },
});
