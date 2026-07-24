import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useSavePushToken } from '@workspace/api-client-react';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;
    // Remote push is not supported inside Expo Go — works in real builds.
    if (Constants.executionEnvironment === 'storeClient') return null;
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const res = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Registers the device for push notifications once the user is signed in,
 * and navigates to the right conversation when a notification is tapped.
 */
export function PushNotifications() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const savePushToken = useSavePushToken();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn || registeredRef.current) return;
    let cancelled = false;
    (async () => {
      const token = await getPushToken();
      if (!token || cancelled) return;
      try {
        await savePushToken.mutateAsync({ data: { token } });
        registeredRef.current = true;
      } catch {
        // Retried next launch — never block the app on push registration.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        conversationId?: number;
      };
      if (data?.conversationId) {
        router.push(`/conversation/${data.conversationId}`);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
