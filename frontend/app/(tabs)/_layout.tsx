import { Tabs } from "expo-router";
import { ClockCounterClockwise, GearSix, VideoCamera } from "phosphor-react-native";
import React from "react";
import { Platform, StyleSheet } from "react-native";

import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Record",
          tabBarButtonTestID: "tab-record",
          tabBarIcon: ({ color, focused }) => <VideoCamera size={24} color={color as string} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarButtonTestID: "tab-history",
          tabBarIcon: ({ color, focused }) => <ClockCounterClockwise size={24} color={color as string} weight={focused ? "fill" : "regular"} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarButtonTestID: "tab-settings",
          tabBarIcon: ({ color, focused }) => <GearSix size={24} color={color as string} weight={focused ? "fill" : "regular"} />,
        }}
      />
    </Tabs>
  );
}
