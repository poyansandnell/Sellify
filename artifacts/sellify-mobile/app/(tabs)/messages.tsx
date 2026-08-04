import React from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import {
  getListConversationsQueryKey,
  useListConversations,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import { formatPrice, imageUrl, timeAgo } from '@/lib/utils';
import { EmptyState, LoadingView, PrimaryButton } from '@/components/Ui';
import colorsConst from '@/constants/colors';

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, language } = useI18n();
  const { isSignedIn } = useAuth();

  const { data: conversations, isLoading } = useListConversations({
    query: {
      enabled: !!isSignedIn,
      refetchInterval: 15000,
      queryKey: getListConversationsQueryKey(),
    },
  });

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 118 : insets.bottom + 90;

  if (!isSignedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="message-circle"
          title={t.signInToSeeMessages}
          action={
            <PrimaryButton label={t.signIn} onPress={() => router.push('/sign-in')} />
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text
        style={[
          styles.heading,
          { color: colors.foreground, paddingTop: topPad + 16 },
        ]}
      >
        {t.messagesTitle}
      </Text>
      {isLoading ? (
        <LoadingView />
      ) : conversations?.length ? (
        <FlatList
          data={conversations}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          renderItem={({ item }) => (
            <Pressable
              testID={`conversation-${item.id}`}
              onPress={() => router.push(`/conversation/${item.id}`)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? colors.secondary : 'transparent',
                  borderBottomColor: colors.border,
                },
              ]}
            >
              {item.listingImage ? (
                <Image
                  source={{ uri: imageUrl(item.listingImage) }}
                  style={styles.thumb}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.muted }]} />
              )}
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text
                    numberOfLines={1}
                    style={[styles.name, { color: colors.foreground }]}
                  >
                    {item.otherPartyName ?? '–'}
                  </Text>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>
                    {timeAgo(item.lastMessageAt, language)}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.listingTitle, { color: colors.mutedForeground }]}
                >
                  {item.listingTitle}
                  {item.listingPrice != null
                    ? ` · ${formatPrice(item.listingPrice, item.listingCurrency ?? 'SEK')}`
                    : ''}
                </Text>
                {item.lastMessage ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.preview,
                      {
                        color:
                          item.unreadCount > 0
                            ? colors.foreground
                            : colors.mutedForeground,
                        fontFamily:
                          item.unreadCount > 0
                            ? 'Inter_600SemiBold'
                            : 'Inter_400Regular',
                      },
                    ]}
                  >
                    {item.lastMessage}
                  </Text>
                ) : null}
              </View>
              {item.unreadCount > 0 ? (
                <View style={[styles.unread, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.unreadText, { color: colors.primaryForeground }]}>
                    {item.unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      ) : (
        <EmptyState
          icon="message-circle"
          title={t.noMessages}
          text={t.noMessagesText}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 56, borderRadius: colorsConst.radius - 4 },
  rowBody: { flex: 1, gap: 2 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  time: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  listingTitle: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  preview: { fontSize: 13 },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
});
