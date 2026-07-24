import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSSO } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { PrimaryButton } from '@/components/Ui';
import colorsConst from '@/constants/colors';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'sign-in' | 'sign-up' | 'verify';

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();

  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const done = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const onOauth = async (strategy: 'oauth_google' | 'oauth_apple') => {
    setError('');
    setBusy(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        done();
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? t.error);
    } finally {
      setBusy(false);
    }
  };

  const onSignIn = async () => {
    if (!signInLoaded || !signIn) return;
    setError('');
    setBusy(true);
    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (attempt.status === 'complete') {
        await setActiveSignIn({ session: attempt.createdSessionId });
        done();
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? t.error);
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async () => {
    if (!signUpLoaded || !signUp) return;
    setError('');
    setBusy(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setMode('verify');
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? t.error);
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (!signUpLoaded || !signUp) return;
    setError('');
    setBusy(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (attempt.status === 'complete') {
        await setActiveSignUp({ session: attempt.createdSessionId });
        done();
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? t.error);
    } finally {
      setBusy(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        bottomOffset={40}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: topPad + 24,
          paddingHorizontal: 24,
          paddingBottom: 40,
        }}
      >
        <Pressable
          testID="close-sign-in"
          onPress={done}
          hitSlop={12}
          style={styles.close}
        >
          <Feather name="x" size={24} color={colors.foreground} />
        </Pressable>

        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Text style={[styles.logoText, { color: colors.primaryForeground }]}>
            S
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t.signInHero}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {t.signInSub}
        </Text>

        {mode !== 'verify' ? (
          <>
            <Pressable
              testID="google-sign-in"
              onPress={() => onOauth('oauth_google')}
              disabled={busy}
              style={({ pressed }) => [
                styles.googleBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed || busy ? 0.7 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.foreground} />
              ) : (
                <>
                  <Feather name="chrome" size={18} color={colors.foreground} />
                  <Text style={[styles.googleText, { color: colors.foreground }]}>
                    {t.continueWithGoogle}
                  </Text>
                </>
              )}
            </Pressable>

            {Platform.OS === 'ios' ? (
              <Pressable
                testID="apple-sign-in"
                onPress={() => onOauth('oauth_apple')}
                disabled={busy}
                style={({ pressed }) => [
                  styles.googleBtn,
                  {
                    backgroundColor: '#000',
                    borderColor: '#000',
                    opacity: pressed || busy ? 0.7 : 1,
                    marginTop: 10,
                  },
                ]}
              >
                <FontAwesome name="apple" size={20} color="#fff" />
                <Text style={[styles.googleText, { color: '#fff' }]}>
                  {t.continueWithApple}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.mutedForeground }]}>
                {t.or}
              </Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>

            <TextInput
              testID="email-input"
              value={email}
              onChangeText={setEmail}
              placeholder={t.email}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder={t.password}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />

            {error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}

            <PrimaryButton
              testID="submit-auth"
              label={mode === 'sign-in' ? t.signIn : t.signUp}
              loading={busy}
              onPress={mode === 'sign-in' ? onSignIn : onSignUp}
            />

            <Pressable
              testID="toggle-mode"
              onPress={() => {
                setError('');
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              }}
              style={styles.toggle}
            >
              <Text style={[styles.toggleText, { color: colors.mutedForeground }]}>
                {mode === 'sign-in' ? t.noAccount : t.hasAccount}{' '}
                <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                  {mode === 'sign-in' ? t.signUp : t.signIn}
                </Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.verifyText, { color: colors.foreground }]}>
              {t.verifyCode}
            </Text>
            <TextInput
              testID="code-input"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                  textAlign: 'center',
                  letterSpacing: 6,
                },
              ]}
            />
            {error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}
            <PrimaryButton
              testID="verify-button"
              label={t.verify}
              loading={busy}
              onPress={onVerify}
            />
          </>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  close: { alignSelf: 'flex-end' },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
  },
  logoText: { fontSize: 30, fontFamily: 'Inter_700Bold' },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginTop: 16,
  },
  sub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
  },
  googleText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  input: {
    height: 52,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  error: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 12,
  },
  toggle: { alignItems: 'center', marginTop: 20 },
  toggleText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  verifyText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 16,
  },
});
