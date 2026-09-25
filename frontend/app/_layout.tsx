import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Alert, LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { registerForPushIfGranted } from "@/src/services/notifications";
import { useSettings } from "@/src/store/settings";
import { setColorScheme, useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

// Foreground notification behaviour — module scope, native only.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Android channel must exist before any push arrives — module scope.
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

function openFromNotification(data: Record<string, any>, push: (url: string) => void) {
  const url = data?.deeplink || data?.action_url;
  if (!url || typeof url !== "string") return;
  if (url.startsWith("http")) Linking.openURL(url);
  else push(url);
}

function ThemeSync() {
  const theme = useSettings((s) => s.theme);
  useEffect(() => {
    setColorScheme(theme === "system" ? null : theme);
  }, [theme]);
  return null;
}

function AppShell() {
  const { colors, scheme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="clip/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const deviceId = useSettings((s) => s.deviceId);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const [fontsLoaded] = useFonts({
    "Geist-Regular": require("../assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("../assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("../assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("../assets/fonts/Geist-Bold.ttf"),
    "SpaceMono-Regular": require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Silent re-registration on every app open (tokens rotate).
  useEffect(() => {
    if (notificationsEnabled) registerForPushIfGranted(deviceId);
  }, [deviceId, notificationsEnabled]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotification(response.notification.request.content.data as Record<string, any>, (u) => router.push(u as any));
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      openFromNotification(response.notification.request.content.data as Record<string, any>, (u) => router.push(u as any));
    });

    // Weekly nudge for users who permanently denied notifications.
    (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== "denied" || canAskAgain) return;
      const lastNudge = await AsyncStorage.getItem("pushNudgeAt");
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (lastNudge && Date.now() - Number(lastNudge) <= oneWeek) return;
      const stamp = () => AsyncStorage.setItem("pushNudgeAt", String(Date.now()));
      Alert.alert(
        "Impact alerts are off",
        "Turn on notifications so you're alerted the moment an impact is detected, even when the screen is off.",
        [
          { text: "Later", style: "cancel", onPress: () => void stamp() },
          {
            text: "Open Settings",
            onPress: async () => {
              await stamp();
              Linking.openSettings();
            },
          },
        ],
      );
    })();

    return () => tapSub.remove();
  }, [router]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <ThemeSync />
              <AppShell />
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
