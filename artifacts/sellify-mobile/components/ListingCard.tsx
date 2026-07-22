import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Listing } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { formatPrice, imageUrl } from '@/lib/utils';
import colorsConst from '@/constants/colors';

export function ListingCard({
  listing,
  width,
}: {
  listing: Listing;
  width: number;
}) {
  const colors = useColors();
  const router = useRouter();
  const { t } = useI18n();
  const img = imageUrl(listing.images[0]);

  return (
    <Pressable
      testID={`listing-card-${listing.id}`}
      onPress={() => router.push(`/listing/${listing.slug}`)}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.imageWrap}>
        {img ? (
          <Image
            source={{ uri: img }}
            style={styles.image}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={[styles.image, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}
          >
            <Feather name="image" size={28} color={colors.mutedForeground} />
          </View>
        )}
        {listing.status === 'sold' ? (
          <View style={[styles.soldBadge, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.soldText, { color: colors.background }]}>
              {t.sold}
            </Text>
          </View>
        ) : null}
        {listing.isFavorited ? (
          <View style={styles.heart}>
            <Feather name="heart" size={16} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.foreground }]}
        >
          {listing.title}
        </Text>
        <Text style={[styles.price, { color: colors.foreground }]}>
          {formatPrice(listing.price, listing.currency)}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.city, { color: colors.mutedForeground }]}
        >
          {listing.city}
        </Text>
      </View>
    </Pressable>
  );
}

export function ListingCardSkeleton({ width }: { width: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { width, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.image, { backgroundColor: colors.muted }]} />
      <View style={styles.body}>
        <View style={[styles.skelLine, { backgroundColor: colors.muted, width: '80%' }]} />
        <View style={[styles.skelLine, { backgroundColor: colors.muted, width: '40%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 1 },
  soldBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  soldText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
    padding: 6,
  },
  body: { padding: 10, gap: 2 },
  title: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  city: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  skelLine: { height: 12, borderRadius: 6, marginTop: 4 },
});
