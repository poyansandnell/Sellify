import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMessagesQueryKey,
  useGetMessages,
  useListConversations,
  useSendMessage,
  useCreateContentReport,
  useBlockUser,
  ContentReportInputReason,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import colorsConst from '@/constants/colors';
import { authFailureDebug, errorDetail, errorStatus } from '@/lib/apiError';
import { ReportModal } from '@/components/ReportModal';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const router = useRouter();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages } = useGetMessages(conversationId, {
    query: {
      enabled: !!conversationId,
      refetchInterval: 5000,
      queryKey: getGetMessagesQueryKey(conversationId),
    },
  });
  const { data: conversations } = useListConversations();
  const conversation = conversations?.find((c) => c.id === conversationId);

  const sendMessage = useSendMessage();
  const [text, setText] = useState('');

  const createReport = useCreateContentReport();
  const blockUser = useBlockUser();
  const [reportMessageId, setReportMessageId] = useState<number | null>(null);

  const inverted = useMemo(
    () => [...(messages ?? [])].reverse(),
    [messages],
  );

  const onSend = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    try {
      await sendMessage.mutateAsync({ id: conversationId, data: { content } });
      queryClient.invalidateQueries();
    } catch (e) {
      if (errorStatus(e) === 422) {
        Alert.alert(t.error, errorDetail(t.error, e));
      } else {
        setText(content);
      }
    }
  };

  const onBlockUser = () => {
    if (!conversation) return;
    const otherUserId = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;

    Alert.alert(t.blockConfirmTitle, t.blockConfirmText, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.blockUser, style: 'destructive', onPress: async () => {
          try {
            await blockUser.mutateAsync({
              data: {
                userId: otherUserId,
                sourceConversationId: conversation.id,
              }
            });
            queryClient.invalidateQueries();
            Alert.alert(t.blockSuccess);
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/messages');
            }
          } catch (e) {
            Alert.alert(t.error, errorDetail(t.error, e));
          }
        }
      }
    ]);
  };

  const onReportMessage = async (reason: ContentReportInputReason, details: string) => {
    if (!reportMessageId || !conversation) return;
    const msg = messages?.find(m => m.id === reportMessageId);
    if (!msg) return;

    try {
      await createReport.mutateAsync({
        data: {
          targetType: 'message',
          reportedUserId: msg.senderId,
          messageId: msg.id,
          conversationId: conversation.id,
          reason,
          details: details || null,
        }
      });
      setReportMessageId(null);
      Alert.alert(t.reportSuccess);
    } catch (e) {
      Alert.alert(t.error, errorDetail(t.error, e));
    }
  };

  const showMessageOptions = (msgId: number) => {
    Alert.alert(t.options, '', [
      { text: t.cancel, style: 'cancel' },
      { text: t.reportMessage, onPress: () => setReportMessageId(msgId) },
    ]);
  };

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const headerHeight = useHeaderHeight();

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          title: conversation?.otherPartyName ?? t.messagesTitle,
          headerLeft: () => (
            <Pressable
              testID="conversation-back-button"
              hitSlop={12}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/messages');
                }
              }}
              style={{ paddingRight: 12 }}
            >
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              testID="block-conversation-user"
              hitSlop={12}
              onPress={onBlockUser}
              style={{ paddingLeft: 12 }}
            >
              <Feather name="slash" size={20} color={colors.destructive} />
            </Pressable>
          ),
        }}
      />
      {conversation ? (
        <View
          style={[
            styles.listingBar,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.listingBarText, { color: colors.foreground }]}
          >
            {conversation.listingTitle}
          </Text>
        </View>
      ) : null}
      <FlatList
        inverted
        data={inverted}
        keyExtractor={(m) => String(m.id)}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => {
          const mine = item.senderId === userId;
          return (
            <Pressable
              testID={`message-${item.id}`}
              onLongPress={() => !mine && showMessageOptions(item.id)}
              delayLongPress={300}
              style={[
                styles.bubble,
                mine
                  ? { backgroundColor: colors.primary, alignSelf: 'flex-end' }
                  : {
                      backgroundColor: colors.card,
                      alignSelf: 'flex-start',
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                    },
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  { color: mine ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {item.content}
              </Text>
            </Pressable>
          );
        }}
      />
      <View
        style={[
          styles.inputBar,
          {
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 8,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TextInput
          testID="chat-input"
          value={text}
          onChangeText={setText}
          placeholder={t.writeMessage}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
        />
        <Pressable
          testID="chat-send"
          onPress={onSend}
          disabled={!text.trim() || sendMessage.isPending}
          style={[
            styles.sendBtn,
            {
              backgroundColor: colors.primary,
              opacity: !text.trim() || sendMessage.isPending ? 0.5 : 1,
            },
          ]}
        >
          <Feather name="send" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ReportModal
        visible={!!reportMessageId}
        onClose={() => setReportMessageId(null)}
        onSubmit={onReportMessage}
        loading={createReport.isPending}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listingBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listingBarText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  messages: { padding: 16, gap: 8 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: colorsConst.radius,
  },
  bubbleText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
