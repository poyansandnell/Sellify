import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useListCategories,
  useListListings,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { EmptyState } from '@/components/Ui';
import colorsConst from '@/constants/colors';

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useI18n();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 16 * 2 - 12) / 2;
  const params = useLocalSearchParams<{ categoryId?: string }>();

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(
    params.categoryId ? Number(params.categoryId) : undefined,
  );

  const { data: categories } = useListCategories();
  const { data, isLoading } = useListListings({
    ...(query.trim() ? { q: query.trim() } : {}),
    ...(categoryId ? { categoryId } : {}),
    limit: 40,
  });

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          testID="back-button"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            testID="search-input"
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            style={[styles.input, { color: colors.foreground }]}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Feather name="x" size={17} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.chipsRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories ?? []}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={styles.chips}
          renderItem={({ item: cat }) => {
            const selected = cat.id === categoryId;
            return (
              <Pressable
                onPress={() =>
                  setCategoryId(selected ? undefined : cat.id)
                }
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: selected
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {language === 'sv' ? cat.nameSv : cat.nameEn}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {isLoading ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <ListingCardSkeleton key={i} width={cardWidth} />
          ))}
        </View>
      ) : data?.items?.length ? (
        <FlatList
          data={data.items}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 12, paddingBottom: bottomPad + 16 }}
          ListHeaderComponent={
            <Text style={[styles.count, { color: colors.mutedForeground }]}>
              {data.total} {t.results}
            </Text>
          }
          renderItem={({ item }) => (
            <ListingCard listing={item} width={cardWidth} />
          )}
        />
      ) : (
        <EmptyState icon="search" title={t.noResults} text={t.tryOtherSearch} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  chipsRow: { paddingBottom: 8 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  count: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
