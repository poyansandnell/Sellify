import React from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import {
  getGetMyFavoritesQueryKey,
  useGetMyFavorites,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { ListingCard } from '@/components/ListingCard';
import { EmptyState, LoadingView } from '@/components/Ui';

export default function FavoritesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { isSignedIn } = useAuth();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 16 * 2 - 12) / 2;

  const { data: favorites, isLoading } = useGetMyFavorites({
    query: { enabled: !!isSignedIn, queryKey: getGetMyFavoritesQueryKey() },
  });

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading ? (
        <LoadingView />
      ) : favorites?.length ? (
        <FlatList
          data={favorites}
          keyExtractor={(l) => String(l.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{
            gap: 12,
            paddingTop: 16,
            paddingBottom: bottomPad + 16,
          }}
          renderItem={({ item }) => (
            <ListingCard listing={item} width={cardWidth} />
          )}
        />
      ) : (
        <EmptyState icon="heart" title={t.noFavorites} text={t.noFavoritesText} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
