import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetSimilarListingsQueryKey,
  useGetListingBySlug,
  useGetSimilarListings,
  useStartConversation,
  useToggleFavorite,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { conditionLabel, useI18n } from '@/lib/i18n';
import { formatPrice, imageUrl, listingUrl } from '@/lib/utils';
import { errorDetail, errorStatus } from '@/lib/apiError';
import { ListingCard } from '@/components/ListingCard';
import {
  EmptyState,
  LoadingView,
  PrimaryButton,
  SecondaryButton,
} from '@/components/Ui';
import colorsConst from '@/constants/colors';

export default function ListingDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useI18n();
  const { width } = useWindowDimensions();
  const { isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: listing,
    isLoading,
    isError,
    refetch,
  } = useGetListingBySlug(slug ?? '');
  const { data: similar } = useGetSimilarListings(listing?.id ?? 0, {
    query: {
      enabled: !!listing?.id,
      queryKey: getGetSimilarListingsQueryKey(listing?.id ?? 0),
    },
  });

  const toggleFavorite = useToggleFavorite();
  const startConversation = useStartConversation();
  const [message, setMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LoadingView />
      </View>
    );
  }

  if (isError || !listing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top }}>
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          hitSlop={12}
          style={{ paddingHorizontal: 16, paddingVertical: 8 }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <EmptyState
          icon="alert-circle"
          title={t.noResults}
          action={<SecondaryButton label={t.retry} onPress={() => refetch()} />}
        />
      </View>
    );
  }

  const isOwner = userId === listing.sellerId;
  const cardWidth = (width - 16 * 2 - 12) / 2;

  const onToggleFavorite = async () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite.mutateAsync({ id: listing.id });
    queryClient.invalidateQueries();
  };

  const onSend = async () => {
    if (!message.trim()) return;
    try {
      const conv = await startConversation.mutateAsync({
        data: { listingId: listing.id, message: message.trim() },
      });
      setMessage('');
      setShowMessageBox(false);
      queryClient.invalidateQueries();
      router.push(`/conversation/${conv.id}`);
    } catch (e) {
      if (errorStatus(e) === 401) {
        Alert.alert(t.sessionExpired);
        router.push('/sign-in');
        return;
      }
      Alert.alert(t.error, errorDetail(t.sendMessage, e));
    }
  };

  const shippingLabel =
    listing.shipping === 'pickup'
      ? t.shippingPickup
      : listing.shipping === 'ship'
        ? t.shippingShip
        : t.shippingBoth;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 110 }}>
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {listing.images.map((img, i) => (
              <Image
                key={i}
                source={{ uri: imageUrl(img) }}
                style={{ width, height: width }}
                contentFit="cover"
              />
            ))}
          </ScrollView>
          {listing.status === 'sold' ? (
            <View style={[styles.soldOverlay, { backgroundColor: colors.foreground }]}>
              <Text style={[styles.soldText, { color: colors.background }]}>
                {t.sold}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={[styles.price, { color: colors.primary }]}>
            {formatPrice(listing.price, listing.currency)}
            {listing.priceType === 'negotiable' ? (
              <Text style={[styles.negotiable, { color: colors.mutedForeground }]}>
                {'  '}{t.negotiable}
              </Text>
            ) : null}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {listing.title}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {listing.city}
            </Text>
            <Feather name="eye" size={13} color={colors.mutedForeground} />
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {listing.viewCount} {t.views}
            </Text>
          </View>

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.badgeText, { color: colors.accentForeground }]}>
                {conditionLabel(listing.condition, language)}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>
                {shippingLabel}
              </Text>
            </View>
            {listing.categoryNameSv ? (
              <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.badgeText, { color: colors.secondaryForeground }]}>
                  {language === 'sv' ? listing.categoryNameSv : listing.categoryNameEn}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t.description}
          </Text>
          <Text style={[styles.description, { color: colors.foreground }]}>
            {listing.description}
          </Text>

          {listing.specifications?.length ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t.specifications}
              </Text>
              <View
                style={[
                  styles.specs,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {listing.specifications.map((spec, i) => (
                  <View key={i} style={styles.specRow}>
                    <Text style={[styles.specLabel, { color: colors.mutedForeground }]}>
                      {spec.label}
                    </Text>
                    <Text style={[styles.specValue, { color: colors.foreground }]}>
                      {spec.value}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t.seller}
          </Text>
          <View
            style={[
              styles.sellerCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={[styles.avatarText, { color: colors.accentForeground }]}>
                {(listing.sellerName ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.sellerName, { color: colors.foreground }]}>
              {listing.sellerName ?? '–'}
            </Text>
          </View>

          {similar?.length ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t.similar}
              </Text>
              <View style={styles.grid}>
                {similar.slice(0, 4).map((item) => (
                  <ListingCard key={item.id} listing={item} width={cardWidth} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.topBar, { top: topPad + 8 }]}>
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          style={styles.roundBtn}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={styles.topBarRight}>
          <Pressable
            testID="share-button"
            onPress={() => {
              const url = listingUrl(listing.slug);
              Share.share(
                Platform.OS === 'ios'
                  ? { message: listing.title, url }
                  : { message: `${listing.title}\n${url}` },
              ).catch(() => {});
            }}
            style={styles.roundBtn}
          >
            <Feather name="share" size={20} color="#fff" />
          </Pressable>
          <Pressable
            testID="favorite-button"
            onPress={onToggleFavorite}
            style={styles.roundBtn}
          >
            <Feather
              name="heart"
              size={20}
              color={listing.isFavorited ? '#ff5a7a' : '#fff'}
            />
          </Pressable>
        </View>
      </View>

      {!isOwner && listing.status === 'active' ? (
        <KeyboardStickyView
          style={styles.footerWrap}
          offset={{ closed: 0, opened: bottomPad }}
        >
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: bottomPad + 12,
              },
            ]}
          >
          {showMessageBox ? (
            <View style={styles.messageRow}>
              <TextInput
                testID="message-input"
                value={message}
                onChangeText={setMessage}
                placeholder={t.messagePlaceholder}
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                multiline
                style={[
                  styles.messageInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
              <Pressable
                testID="send-message-button"
                onPress={onSend}
                disabled={startConversation.isPending || !message.trim()}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: startConversation.isPending || !message.trim() ? 0.5 : 1,
                  },
                ]}
              >
                <Feather name="send" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>
          ) : (
            <PrimaryButton
              testID="contact-seller-button"
              label={isSignedIn ? t.sendMessage : t.signInToChat}
              icon="message-circle"
              onPress={() => {
                if (!isSignedIn) {
                  router.push('/sign-in');
                } else {
                  setShowMessageBox(true);
                  setMessage(t.messagePlaceholder);
                }
              }}
            />
          )}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topBarRight: { flexDirection: 'row', gap: 10 },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  soldText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  body: { padding: 16, gap: 6 },
  price: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  negotiable: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  title: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  meta: { fontSize: 13, fontFamily: 'Inter_400Regular', marginRight: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginTop: 20,
    marginBottom: 8,
  },
  description: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  specs: {
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  specRow: { flexDirection: 'row', justifyContent: 'space-between' },
  specLabel: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  specValue: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  sellerName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  messageRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  messageInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 13,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
