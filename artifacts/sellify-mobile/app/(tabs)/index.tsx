import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGetHomeFeed } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { EmptyState } from '@/components/Ui';
import colorsConst from '@/constants/colors';
import { useAuth } from '@clerk/clerk-expo';
import {
  apiBaseUrl,
  BUILD_TAG,
  clerkConfigError,
  clerkProxyUrl,
  clerkPubKey,
} from '@/lib/clerkConfig';
import { mark, startupDiag } from '@/lib/startupDiag';

// Temporary startup diagnostics (tap the "Sellify" heading 5 times).
// Works WITHOUT signing in — shows build tag, API base, Clerk status and a
// live probe of the public listings endpoint. Removal tracked with the
// profile-screen debug panel.
function StartupDiagnostics({ onClose }: { onClose: () => void }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [probe, setProbe] = useState<string>('testar…');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/listings`);
        if (!cancelled) setProbe(`HTTP ${res.status}`);
      } catch (e) {
        if (!cancelled)
          setProbe(`FEL: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = [
    `build: ${BUILD_TAG}`,
    `api-bas: ${apiBaseUrl}`,
    `GET /api/listings (live-test): ${probe}`,
    `clerk laddad: ${isLoaded ? 'ja' : 'nej'}`,
    `clerk inloggad: ${isSignedIn ? 'ja' : 'nej'}`,
    `clerk-nyckel: ${clerkPubKey ? clerkPubKey.slice(0, 16) + '…' : 'SAKNAS'}`,
    `clerk-proxy: ${clerkProxyUrl ?? 'ingen'}`,
    `konfig-fel: ${clerkConfigError ?? 'inget'}`,
    `första JS-fel: ${startupDiag.firstError ?? 'inget'}`,
    `fel från FÖRRA starten: ${startupDiag.previousError ?? 'inget'}`,
    `första API-anrop: ${startupDiag.firstRequest ?? 'INGET ännu'}`,
    `start: ${startupDiag.startedAt}`,
    '— livscykel —',
    ...(startupDiag.checkpoints.length
      ? startupDiag.checkpoints
      : ['(inga checkpoints nådda)']),
  ].join('\n');

  return (
    <View style={diagStyles.overlay}>
      <Text style={diagStyles.title}>Startdiagnostik</Text>
      <Text selectable style={diagStyles.mono}>
        {rows}
      </Text>
      <Pressable onPress={onClose} style={diagStyles.close}>
        <Text style={diagStyles.closeText}>Stäng</Text>
      </Pressable>
    </View>
  );
}

const diagStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderRadius: 12,
    padding: 16,
  },
  title: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 8 },
  mono: { color: '#d1fae5', fontSize: 12, lineHeight: 18 },
  close: { marginTop: 12, alignSelf: 'flex-end' },
  closeText: { color: '#93c5fd', fontWeight: '600' },
});

export default function HomeScreen() {
  const [diagTaps, setDiagTaps] = useState(0);
  const [showDiag, setShowDiag] = useState(false);
  React.useEffect(() => {
    mark('home-renderad');
  }, []);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useI18n();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 16 * 2 - 12) / 2;

  const { data, isLoading, isError, refetch, isRefetching } = useGetHomeFeed();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 118 : insets.bottom + 90;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingBottom: bottomPad,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              const n = diagTaps + 1;
              setDiagTaps(n);
              if (n >= 5) {
                setDiagTaps(0);
                setShowDiag(true);
              }
            }}
          >
            <Text style={[styles.brand, { color: colors.primary }]}>
              Sellify
            </Text>
          </Pressable>
          <Pressable
            testID="search-bar"
            onPress={() => router.push('/search')}
            style={({ pressed }) => [
              styles.searchBar,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <Text style={[styles.searchText, { color: colors.mutedForeground }]}>
              {t.searchPlaceholder}
            </Text>
          </Pressable>
        </View>

        {data?.categories?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {data.categories.map((cat) => (
              <Pressable
                key={cat.id}
                testID={`category-chip-${cat.slug}`}
                onPress={() =>
                  router.push({
                    pathname: '/search',
                    params: { categoryId: String(cat.id) },
                  })
                }
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.foreground }]}>
                  {language === 'sv' ? cat.nameSv : cat.nameEn}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {t.newest}
        </Text>

        {isLoading ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <ListingCardSkeleton key={i} width={cardWidth} />
            ))}
          </View>
        ) : isError ? (
          <EmptyState icon="alert-circle" title={t.error} text={t.retry} />
        ) : data?.newest?.length ? (
          <View style={styles.grid}>
            {data.newest.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                width={cardWidth}
              />
            ))}
          </View>
        ) : (
          <EmptyState icon="package" title={t.noResults} />
        )}

        {data?.nearby?.length ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t.nearby}
            </Text>
            <View style={styles.grid}>
              {data.nearby.map((listing) => (
                <ListingCard
                  key={`nearby-${listing.id}`}
                  listing={listing}
                  width={cardWidth}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
      {showDiag ? (
        <StartupDiagnostics onClose={() => setShowDiag(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, gap: 12 },
  brand: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  searchText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  chips: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sectionTitle: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
});
