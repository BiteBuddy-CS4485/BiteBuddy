import React from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AuthLandingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>BiteBuddy</Text>
        <Text style={styles.subtitle}>Find a bite with your buddies</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.footerLink}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f87566',
    borderRadius: 34,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 58,
  },
  title: {
    fontSize: 54,
    lineHeight: 56,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 36,
    color: '#fff',
    opacity: 0.95,
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 38,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#fb7e6a',
    borderRadius: 30,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#b75a3e',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 35,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  footerText: {
    marginTop: 18,
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  footerLink: {
    marginTop: 2,
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});