import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import colorsConst from '@/constants/colors';

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.primary,
          opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <>
          {icon ? (
            <Feather name={icon} size={18} color={colors.primaryForeground} />
          ) : null}
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.secondary,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? (
        <Feather name={icon} size={18} color={colors.secondaryForeground} />
      ) : null}
      <Text style={[styles.buttonText, { color: colors.secondaryForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={26} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {text ? (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {text}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function LoadingView() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: colorsConst.radius,
    paddingHorizontal: 20,
  },
  buttonText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
