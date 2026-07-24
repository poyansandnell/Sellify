import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useTranscribeAudio } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useI18n } from '@/lib/i18n';
import colorsConst from '@/constants/colors';

async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        resolve(result.substring(result.indexOf(',') + 1));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  const FileSystem = await import('expo-file-system/legacy');
  return await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  /** Append transcribed speech to the latest notes (functional update in the parent). */
  onAppendText: (text: string) => void;
  questions?: string[];
  /** When set, a send button appears next to the text input for typed notes. */
  onSend?: () => void;
  sendPending?: boolean;
}

/**
 * Free-text + big microphone button for adding extra details about an item.
 * Spoken audio is transcribed server-side and appended to the text value.
 */
export function VoiceNoteInput({
  value,
  onChangeText,
  onAppendText,
  questions,
  onSend,
  sendPending,
}: Props) {
  const colors = useColors();
  const { t } = useI18n();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const busyRef = useRef(false);
  const recordingRef = useRef(false);
  const transcribe = useTranscribeAudio();

  useEffect(() => {
    return () => {
      // Never leave the mic session orphaned if the step/screen changes mid-recording.
      if (recordingRef.current) {
        recordingRef.current = false;
        Promise.resolve(recorder.stop())
          .then(() => setAudioModeAsync({ allowsRecording: false }))
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRecording = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (!recording) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) return;
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
        recordingRef.current = true;
        setRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        recordingRef.current = false;
        setRecording(false);
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        const uri = recorder.uri;
        if (!uri) throw new Error('No recording');
        const audioBase64 = await uriToBase64(uri);
        const { text } = await transcribe.mutateAsync({
          data: { audioBase64 },
        });
        if (text.trim()) {
          onAppendText(text.trim());
        }
      }
    } catch {
      recordingRef.current = false;
      setRecording(false);
      alertMicFailed(t.micFailed);
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t.extraInfoTitle}
      </Text>
      {questions && questions.length > 0 ? (
        <View style={styles.questions}>
          <Text style={[styles.questionsLabel, { color: colors.primary }]}>
            {t.aiQuestions}
          </Text>
          {questions.map((q, i) => (
            <Text
              key={i}
              style={[styles.question, { color: colors.foreground }]}
            >
              •  {q}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t.extraInfoHint}
        </Text>
      )}
      <View style={styles.inputRow}>
        <TextInput
          testID="extra-info-input"
          value={value}
          onChangeText={onChangeText}
          placeholder={t.extraInfoPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.input,
            {
              flex: 1,
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
        />
        {onSend && value.trim() ? (
          <Pressable
            testID="send-notes-button"
            onPress={onSend}
            disabled={sendPending}
            style={[
              styles.sendBtn,
              { backgroundColor: colors.primary, opacity: sendPending ? 0.6 : 1 },
            ]}
          >
            {sendPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="send" size={20} color={colors.primaryForeground} />
            )}
          </Pressable>
        ) : null}
      </View>
      <Pressable
        testID="mic-button"
        onPress={toggleRecording}
        disabled={transcribe.isPending}
        style={[
          styles.micBtn,
          {
            backgroundColor: recording ? '#e5484d' : colors.primary,
            opacity: transcribe.isPending ? 0.6 : 1,
          },
        ]}
      >
        {transcribe.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Feather
            name={recording ? 'square' : 'mic'}
            size={26}
            color={colors.primaryForeground}
          />
        )}
        <Text style={[styles.micText, { color: colors.primaryForeground }]}>
          {transcribe.isPending
            ? t.transcribing
            : recording
              ? t.recordingTap
              : t.tapToTalk}
        </Text>
      </Pressable>
    </View>
  );
}

function alertMicFailed(message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message);
  } else {
    const { Alert } = require('react-native');
    Alert.alert(message);
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: colorsConst.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  hint: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  questions: { gap: 4 },
  questionsLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  question: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  input: {
    minHeight: 70,
    maxHeight: 140,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlignVertical: 'top',
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: 28,
  },
  micText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
