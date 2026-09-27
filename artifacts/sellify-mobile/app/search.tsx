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
import { CountryPicker } from '@/components/CountryPicker';
import { detectDeviceLocation, type DetectedLocation } from '@/lib/location';
import colorsConst from '@/constants/colors';

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useI18n();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 16 * 2 - 12) / 2;
  const params = useLocalSearchParams<{
    categoryId?: string;
    country?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  }>();

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(
    params.categoryId ? Number(params.categoryId) : undefined,
  );
  const [locationFilters, setLocationFilters] = useState<DetectedLocation>({
    country: typeof params.country === "string" ? params.country : "",
    city: typeof params.city === "string" ? params.city : "",
    region: typeof params.region === "string" ? params.region : "",
    postalCode: typeof params.postalCode === "string" ? params.postalCode : "",
  });
  const [locationDraft, setLocationDraft] = useState(locationFilters);
  const [showLocationFilters, setShowLocationFilters] = useState(
    Boolean(params.country || params.city || params.region || params.postalCode),
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const { data: categories } = useListCategories();
  const { data, isLoading } = useListListings({
    ...(query.trim() ? { q: query.trim() } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(locationFilters.country ? { country: locationFilters.country } : {}),
    ...(locationFilters.city ? { city: locationFilters.city } : {}),
    ...(locationFilters.region ? { region: locationFilters.region } : {}),
    ...(locationFilters.postalCode
      ? { postalCode: locationFilters.postalCode }
      : {}),
    limit: 40,
  });

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocationError("");
    try {
      setLocationDraft(await detectDeviceLocation());
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setLocating(false);
    }
  };

  const applyLocation = () => {
    setLocationFilters({
      country: locationDraft.country.trim().toUpperCase(),
      city: locationDraft.city.trim(),
      region: locationDraft.region.trim(),
      postalCode: locationDraft.postalCode.trim(),
    });
    setShowLocationFilters(false);
  };

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

      <View style={styles.locationSection}>
        <Pressable
          testID="location-filter-toggle"
          accessibilityRole="button"
          accessibilityState={{ expanded: showLocationFilters }}
          onPress={() => setShowLocationFilters((visible) => !visible)}
          style={[
            styles.locationToggle,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="map-pin" size={16} color={colors.primary} />
          <Text style={[styles.locationToggleText, { color: colors.foreground }]}>
            {locationFilters.city || locationFilters.country
              ? [locationFilters.city, locationFilters.region, locationFilters.country]
                  .filter(Boolean)
                  .join(", ")
              : language === "sv" ? "Välj land eller område" : "Choose country or area"}
          </Text>
          <Feather
            name={showLocationFilters ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </Pressable>
        {showLocationFilters ? (
          <View
            style={[
              styles.locationPanel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <CountryPicker
              testID="search-country"
              value={locationDraft.country}
              language={language}
              allowEmpty
              onChange={(country) =>
                setLocationDraft((current) => ({ ...current, country }))
              }
            />
            {(
              [
                ["city", language === "sv" ? "Stad" : "City"],
                ["region", language === "sv" ? "Region eller delstat" : "Region or state"],
                ["postalCode", language === "sv" ? "Postnummer" : "Postal code"],
              ] as const
            ).map(([key, label]) => (
              <View key={key}>
                <Text style={[styles.locationLabel, { color: colors.mutedForeground }]}>
                  {label}
                </Text>
                <TextInput
                  testID={`search-${key}`}
                  value={locationDraft[key]}
                  onChangeText={(value) =>
                    setLocationDraft((current) => ({ ...current, [key]: value }))
                  }
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.locationInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                />
              </View>
            ))}
            <Pressable
              testID="search-use-location"
              disabled={locating}
              onPress={useCurrentLocation}
              style={styles.useLocation}
            >
              <Feather name="crosshair" size={16} color={colors.primary} />
              <Text style={[styles.useLocationText, { color: colors.primary }]}>
                {locating
                  ? language === "sv" ? "Hämtar plats…" : "Finding location…"
                  : language === "sv" ? "Använd min plats" : "Use my location"}
              </Text>
            </Pressable>
            <Text style={[styles.locationNote, { color: colors.mutedForeground }]}>
              {language === "sv"
                ? "GPS används bara när du trycker. Exakta koordinater sparas inte."
                : "GPS is used only when you tap. Exact coordinates are not stored."}
            </Text>
            {Platform.OS === "web" ? (
              <Text style={[styles.locationNote, { color: colors.mutedForeground }]}>
                © OpenStreetMap contributors
              </Text>
            ) : null}
            {locationError ? (
              <Text testID="search-location-error" style={styles.locationError}>
                {locationError}
              </Text>
            ) : null}
            <Pressable
              testID="apply-location-filter"
              onPress={applyLocation}
              style={[styles.applyLocation, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.applyLocationText, { color: colors.primaryForeground }]}>
                {language === "sv" ? "Visa annonser här" : "Show listings here"}
              </Text>
            </Pressable>
          </View>
        ) : null}
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
  locationSection: { paddingHorizontal: 16, paddingBottom: 10 },
  locationToggle: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  locationToggleText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  locationPanel: {
    marginTop: 8,
    padding: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
  },
  locationLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  locationInput: {
    height: 40,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    fontSize: 14,
  },
  useLocation: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 3 },
  useLocationText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  locationNote: { fontSize: 11, lineHeight: 15 },
  locationError: { color: "#b91c1c", fontSize: 12 },
  applyLocation: {
    minHeight: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  applyLocationText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
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
