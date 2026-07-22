import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useI18n } from '@/lib/i18n';

function NativeTabLayout() {
  const { t } = useI18n();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>{t.tabHome}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sell">
        <Icon sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }} />
        <Label>{t.tabSell}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="messages">
        <Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} />
        <Label>{t.tabMessages}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-listings">
        <Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
        <Label>{t.tabListings}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>{t.tabProfile}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const { t } = useI18n();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  const icon =
    (sfName: string, featherName: keyof typeof Feather.glyphMap) =>
    ({ color }: { color: string }) =>
      isIOS ? (
        <SymbolView name={sfName as any} tintColor={color} size={24} />
      ) : (
        <Feather name={featherName} size={22} color={color} />
      );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t.tabHome, tabBarIcon: icon('house', 'home') }}
      />
      <Tabs.Screen
        name="sell"
        options={{ title: t.tabSell, tabBarIcon: icon('plus.circle', 'plus-circle') }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: t.tabMessages, tabBarIcon: icon('bubble.left', 'message-circle') }}
      />
      <Tabs.Screen
        name="my-listings"
        options={{ title: t.tabListings, tabBarIcon: icon('square.grid.2x2', 'grid') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t.tabProfile, tabBarIcon: icon('person', 'user') }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
