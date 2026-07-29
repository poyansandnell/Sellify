import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PushNotifications } from '@/components/PushNotifications';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import {
  setAuthTokenGetter,
  setBaseUrl,
} from '@workspace/api-client-react';
import { I18nProvider, useI18n } from '@/lib/i18n';

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

import { clerkPubKey, clerkProxyUrl } from '@/lib/clerkConfig';
import { tokenCache } from '@/lib/clerkSession';

function AuthTokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.warn('[auth] getToken() returned null — request will be sent unauthenticated');
        }
        return token ?? null;
      } catch (e) {
        console.warn('[auth] getToken() threw:', e instanceof Error ? e.message : String(e));
        return null;
      }
    });
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function RootLayoutNav() {
  const { t } = useI18n();
  return (
    <Stack screenOptions={{ headerBackTitle: t.back }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="listing/[slug]" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen
        name="conversation/[id]"
        options={{ headerShown: true, title: '' }}
      />
      <Stack.Screen
        name="favorites"
        options={{ headerShown: true, title: t.favorites }}
      />
      <Stack.Screen
        name="sign-in"
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={clerkPubKey}
          proxyUrl={clerkProxyUrl}
          tokenCache={tokenCache}
        >
          <QueryClientProvider client={queryClient}>
            <AuthTokenBridge />
            <PushNotifications />
            <GestureHandlerRootView>
              <KeyboardProvider>
                <I18nProvider>
                  <RootLayoutNav />
                </I18nProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
