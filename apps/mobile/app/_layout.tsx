import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function AuthGate() {
  const { session, loading, needsProfileSetup } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)');
    } else if (session && needsProfileSetup) {
      if (segments.join('/') !== '(auth)/profile-setup') {
        router.replace('/(auth)/profile-setup');
      }
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, needsProfileSetup, segments]);

  if (loading) return null;

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
