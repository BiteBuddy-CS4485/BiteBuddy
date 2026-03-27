import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function AuthGate() {
  const { session, loading, needsProfileSetup } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    const currentRoute = segments.join("/");
    const inProfileSetup = currentRoute === "(auth)/profile-setup";
    const inResetPassword = currentRoute === "(auth)/reset-password";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (
      session &&
      needsProfileSetup &&
      !inProfileSetup &&
      !inResetPassword
    ) {
      router.replace("/(auth)/profile-setup");
    } else if (session && inAuthGroup && !inProfileSetup && !inResetPassword) {
      router.replace("/(tabs)");
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
