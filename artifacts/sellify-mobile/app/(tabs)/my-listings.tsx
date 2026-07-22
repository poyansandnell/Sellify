import React from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMyListingsQueryKey,
  useDeleteListing,
  useGetMyListings,
  useMarkListingSold,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { formatPrice, imageUrl } from '@/lib/utils';
import { EmptyState, LoadingView, PrimaryButton } from '@/components/Ui';
import colorsConst from '@/constants/colors';

export default function MyListingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const { data: listings, isLoading } = useGetMyListings({
    query: { enabled: !!isSignedIn, queryKey: getGetMyListingsQueryKey() },
  });
  const markSold = useMarkListingSold();
  const deleteListing = useDeleteListing();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 118 : insets.bottom + 90;

  if (!isSignedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="grid"
          title={t.signInToSeeListings}
          action={
            <PrimaryButton label={t.signIn} onPress={() => router.push('/sign-in')} />
          }
        />
      </View>
    );
  }

  const onMarkSold = async (id: number) => {
    await markSold.mutateAsync({ id });
    queryClient.invalidateQueries();
  };

  const onDelete = (id: number) => {
    Alert.alert(t.deleteConfirm, undefined, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          await deleteListing.mutateAsync({ id });
          queryClient.invalidateQueries();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          {t.myListings}
        </Text>
        <Pressable
          testID="create-listing-button"
          onPress={() => router.push('/(tabs)/sell')}
          style={({ pressed }) => [
            styles.createBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>
            {t.createListing}
          </Text>
        </Pressable>
      </View>
      {isLoading ? (
        <LoadingView />
      ) : listings?.length ? (
        <FlatList
          data={listings}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: bottomPad,
            gap: 12,
          }}
          renderItem={({ item }) => (
            <Pressable
              testID={`my-listing-${item.id}`}
              onPress={() => router.push(`/listing/${item.slug}`)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {item.images[0] ? (
                <Image
                  source={{ uri: imageUrl(item.images[0]) }}
                  style={styles.thumb}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.muted }]} />
              )}
              <View style={styles.cardBody}>
                <Text
                  numberOfLines={1}
                  style={[styles.title, { color: colors.foreground }]}
                >
                  {item.title}
                </Text>
                <Text style={[styles.price, { color: colors.foreground }]}>
                  {formatPrice(item.price, item.currency)}
                </Text>
                <View style={styles.statsRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          item.status === 'active'
                            ? colors.accent
                            : item.status === 'sold'
                              ? colors.secondary
                              : colors.muted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            item.status === 'active'
                              ? colors.accentForeground
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {item.status === 'active'
                        ? t.active
                        : item.status === 'sold'
                          ? t.sold
                          : t.draft}
                    </Text>
                  </View>
                  <Feather name="eye" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.stat, { color: colors.mutedForeground }]}>
                    {item.viewCount}
                  </Text>
                  <Feather name="heart" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.stat, { color: colors.mutedForeground }]}>
                    {item.favoriteCount}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                {item.status === 'active' ? (
                  <Pressable
                    testID={`mark-sold-${item.id}`}
                    onPress={() => onMarkSold(item.id)}
                    hitSlop={8}
                    style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
                  >
                    <Feather name="check-circle" size={16} color={colors.secondaryForeground} />
                  </Pressable>
                ) : null}
                <Pressable
                  testID={`delete-${item.id}`}
                  onPress={() => onDelete(item.id)}
                  hitSlop={8}
                  style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <EmptyState
          icon="package"
          title={t.noListings}
          text={t.noListingsText}
          action={
            <PrimaryButton
              label={t.createListing}
              icon="plus"
              onPress={() => router.push('/(tabs)/sell')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  heading: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  createBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  thumb: { width: 72, height: 72, borderRadius: colorsConst.radius - 6 },
  cardBody: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  price: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginRight: 4,
  },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  stat: { fontSize: 12, fontFamily: 'Inter_400Regular', marginRight: 4 },
  actions: { gap: 8 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
