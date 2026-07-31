// Must be the very first import so the global error handler is installed
// before any other app module can throw during bundle evaluation.
import { mark, startupDiag } from '@/lib/startupDiag';
import React, { useEffect, useState } from 'react';
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
  setRequestObserver,
} from '@workspace/api-client-react';
import { I18nProvider, useI18n } from '@/lib/i18n';

mark('layout-module-eval');
setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
setRequestObserver((url, method) => {
  if (!startupDiag.firstRequest) {
    startupDiag.firstRequest = `${method} ${url} @ ${new Date().toISOString()}`;
  }
});
mark('custom-fetch-initierad');

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

import { clerkPubKey, clerkProxyUrl } from '@/lib/clerkConfig';
import { tokenCache } from '@/lib/clerkSession';

function AuthTokenBridge() {
  // This component renders inside ClerkProvider and calls useAuth() — if it
  // mounts, ClerkProvider initialized without throwing.
  const { getToken } = useAuth();
  useEffect(() => {
    mark('clerk-provider-initierad');
    mark('auth-getter-registrerad');
  }, []);
  useEffect(() => {
    setAuthTokenGetter(async (opts) => {
      try {
        const token = await getToken(
          opts?.fresh ? { skipCache: true } : undefined,
        );
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

  // Never let font loading block the app forever: if fonts have not resolved
  // after 5 seconds, render anyway with system fonts.
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFontTimedOut(true), 5000);
    return () => clearTimeout(id);
  }, []);

  const ready = fontsLoaded || Boolean(fontError) || fontTimedOut;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

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
