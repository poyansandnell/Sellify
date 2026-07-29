import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import {
  getGetMeQueryKey,
  useDeleteMyAccount,
  useGetMe,
} from '@workspace/api-client-react';
import {
  getLastAuthHeaderSent,
  getLastHttpStatus,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n, type Language } from '@/lib/i18n';
import {
  BUILD_TAG,
  apiBaseUrl,
  clerkProxyUrl,
  clerkPubKey,
} from '@/lib/clerkConfig';
import { clearClerkTokenCache } from '@/lib/clerkSession';
import { EmptyState, PrimaryButton } from '@/components/Ui';
import colorsConst from '@/constants/colors';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language, setLanguage } = useI18n();
  const { isSignedIn, signOut, userId, getToken } = useAuth();
  const { user } = useUser();

  // Temporary debug panel (activated by tapping the heading 5 times).
  const [debugTaps, setDebugTaps] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const showDebug = async () => {
    let tokenState = 'nej';
    try {
      tokenState = (await getToken()) ? 'ja' : 'nej (null)';
    } catch (e) {
      tokenState = `fel: ${e instanceof Error ? e.message : String(e)}`;
    }
    setDebugInfo(
      [
        `build: ${BUILD_TAG}`,
        `inloggad: ${isSignedIn ? 'ja' : 'nej'}`,
        `userId: ${userId ?? '–'}`,
        `token finns: ${tokenState}`,
        `API-bas: ${apiBaseUrl}`,
        `clerk-nyckel: ${clerkPubKey ? clerkPubKey.slice(0, 16) + '…' : 'SAKNAS'}`,
        `clerk-proxy: ${clerkProxyUrl ?? 'ingen'}`,
        `senaste HTTP-status: ${getLastHttpStatus() ?? '–'}`,
        `Authorization skickades: ${getLastAuthHeaderSent() ? 'ja' : 'nej'}`,
      ].join('\n'),
    );
  };
  const onHeadingTap = () => {
    const n = debugTaps + 1;
    setDebugTaps(n);
    if (n >= 5) {
      setDebugTaps(0);
      void showDebug();
    }
  };

  const { data: me } = useGetMe({
    query: { enabled: !!isSignedIn, queryKey: getGetMeQueryKey() },
  });
  const deleteAccount = useDeleteMyAccount();
  const [deleting, setDeleting] = useState(false);

  const onDeleteAccount = () => {
    Alert.alert(t.deleteAccount, t.deleteAccountWarning, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteAccountConfirm,
        style: 'destructive',
        onPress: async () => {
          if (deleting) return;
          setDeleting(true);
          try {
            await deleteAccount.mutateAsync();
            await signOut();
            router.replace('/');
          } catch {
            Alert.alert(t.error);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 118 : insets.bottom + 90;

  const langButton = (lang: Language, label: string) => (
    <Pressable
      key={lang}
      testID={`lang-${lang}`}
      onPress={() => setLanguage(lang)}
      style={[
        styles.langBtn,
        {
          backgroundColor: language === lang ? colors.primary : colors.card,
          borderColor: language === lang ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.langText,
          {
            color:
              language === lang ? colors.primaryForeground : colors.foreground,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 16,
          paddingBottom: bottomPad,
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={[styles.heading, { color: colors.foreground }]}
          onPress={onHeadingTap}
        >
          {t.profile}
        </Text>

        {debugInfo ? (
          <Pressable
            onPress={() => setDebugInfo(null)}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Inter_400Regular',
                color: colors.mutedForeground,
              }}
              selectable
            >
              {debugInfo}
            </Text>
          </Pressable>
        ) : null}

        {isSignedIn ? (
          <>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.avatarText, { color: colors.accentForeground }]}>
                  {(me?.displayName ?? user?.firstName ?? '?')
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>
                  {me?.displayName ?? user?.fullName ?? ''}
                </Text>
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                  {me?.activeListingCount ?? 0} {t.activeListings} ·{' '}
                  {me?.soldListingCount ?? 0} {t.soldListings}
                </Text>
              </View>
            </View>

            <Pressable
              testID="favorites-link"
              onPress={() => router.push('/favorites')}
              style={({ pressed }) => [
                styles.menuRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="heart" size={18} color={colors.foreground} />
              <Text style={[styles.menuText, { color: colors.foreground }]}>
                {t.favorites}
              </Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          </>
        ) : (
          <EmptyState
            icon="user"
            title={t.signInHero}
            text={t.signInSub}
            action={
              <PrimaryButton
                testID="profile-sign-in"
                label={t.signIn}
                onPress={() => router.push('/sign-in')}
              />
            }
          />
        )}

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          {t.language}
        </Text>
        <View style={styles.langRow}>
          {langButton('sv', t.swedish)}
          {langButton('en', t.english)}
        </View>

        {isSignedIn ? (
          <Pressable
            testID="sign-out"
            onPress={async () => {
              try {
                await signOut();
              } finally {
                await clearClerkTokenCache();
              }
            }}
            style={({ pressed }) => [
              styles.menuRow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
                marginTop: 24,
              },
            ]}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.menuText, { color: colors.destructive }]}>
              {t.signOut}
            </Text>
          </Pressable>
        ) : null}

        {isSignedIn ? (
          <Pressable
            testID="delete-account"
            onPress={onDeleteAccount}
            disabled={deleting}
            style={({ pressed }) => [
              styles.menuRow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed || deleting ? 0.6 : 1,
                marginTop: 12,
              },
            ]}
          >
            <Feather name="trash-2" size={18} color={colors.destructive} />
            <Text style={[styles.menuText, { color: colors.destructive }]}>
              {t.deleteAccount}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontSize: 24, fontFamily: 'Inter_700Bold', paddingBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  name: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  menuText: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 10,
  },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1,
    height: 46,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
