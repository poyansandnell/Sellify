import React, { useMemo, useState } from 'react';
import {
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
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMessagesQueryKey,
  useGetMessages,
  useListConversations,
  useSendMessage,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import colorsConst from '@/constants/colors';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
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
    } catch {
      setText(content);
    }
  };

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{ title: conversation?.otherPartyName ?? t.messagesTitle }}
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
            <View
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
            </View>
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
