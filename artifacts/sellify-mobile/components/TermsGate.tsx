import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { PrimaryButton, SecondaryButton } from '@/components/Ui';
import colorsConst from '@/constants/colors';
import { useGetTermsAcceptance, getGetTermsAcceptanceQueryKey, useAcceptTerms } from '@workspace/api-client-react';

export function TermsGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const colors = useColors();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data: termsData, isLoading: isLoadingTerms, refetch } = useGetTermsAcceptance({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetTermsAcceptanceQueryKey(),
    }
  });

  const acceptTerms = useAcceptTerms();
  const [processingPending, setProcessingPending] = useState(false);

  useEffect(() => {
    if (isSignedIn && termsData && termsData.currentVersion !== termsData.acceptedVersion) {
      // Check if we have a pending acceptance
      AsyncStorage.getItem('pendingTermsAcceptance').then((pendingRaw) => {
        if (pendingRaw && !processingPending) {
          try {
            const pending = JSON.parse(pendingRaw);
            const isExpired = Date.now() - pending.timestamp > 15 * 60 * 1000;

            if (isExpired) {
              AsyncStorage.removeItem('pendingTermsAcceptance');
            } else if (pending.version === termsData.currentVersion) {
              setProcessingPending(true);
              acceptTerms.mutateAsync({ data: { version: pending.version } })
                .then(() => {
                  AsyncStorage.removeItem('pendingTermsAcceptance');
                  queryClient.invalidateQueries({ queryKey: getGetTermsAcceptanceQueryKey() });
                })
                .catch(() => {
                  setProcessingPending(false);
                });
            }
          } catch (e) {
            AsyncStorage.removeItem('pendingTermsAcceptance');
          }
        }
      });
    }
  }, [isSignedIn, termsData, processingPending]);

  const onAccept = async () => {
    if (!termsData?.currentVersion) return;
    try {
      await acceptTerms.mutateAsync({ data: { version: termsData.currentVersion } });
      await AsyncStorage.removeItem('pendingTermsAcceptance');
      queryClient.invalidateQueries({ queryKey: getGetTermsAcceptanceQueryKey() });
    } catch (e) {
      Alert.alert(t.error, t.error);
    }
  };

  const openLink = (path: string) => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) {
      Alert.alert(t.error, t.missingDomainConfig);
      return;
    }
    WebBrowser.openBrowserAsync(`https://${domain}${path}`);
  };

  const needsAcceptance = isSignedIn && termsData && termsData.currentVersion !== termsData.acceptedVersion;

  return (
    <View style={styles.container}>
      {children}
      {needsAcceptance ? (
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
          <View style={styles.content}>
            <View style={[styles.iconBox, { backgroundColor: colors.primary }]}>
              <Feather name="file-text" size={32} color={colors.primaryForeground} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{t.termsUpdatedTitle}</Text>
            <Text style={[styles.text, { color: colors.mutedForeground }]}>{t.termsUpdatedText}</Text>

            <View style={styles.links}>
              <Pressable testID="terms-link" onPress={() => openLink('/terms')}>
                <Text style={[styles.link, { color: colors.primary }]}>{t.termsOfUse}</Text>
              </Pressable>
              <Text style={{ color: colors.mutedForeground }}> {t.and} </Text>
              <Pressable testID="privacy-link" onPress={() => openLink('/privacy')}>
                <Text style={[styles.link, { color: colors.primary }]}>{t.privacyPolicy}</Text>
              </Pressable>
            </View>

            {processingPending ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24, paddingVertical: 14 }} />
            ) : (
              <View style={{ marginTop: 24, width: '100%' }}>
                <PrimaryButton
                  testID="accept-updated-terms"
                  label={t.accept}
                  onPress={onAccept}
                  loading={acceptTerms.isPending}
                  disabled={acceptTerms.isPending}
                />
              </View>
            )}

            <View style={{ marginTop: 12, width: '100%' }}>
              <SecondaryButton
                label={t.retry}
                onPress={() => refetch()}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  text: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  link: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    textDecorationLine: 'underline',
  },
});