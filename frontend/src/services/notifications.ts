import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerPushToken } from "@/src/services/api";

export type NotifPermission = "granted" | "denied" | "undetermined" | "blocked" | "unsupported";

export async function getNotificationPermission(): Promise<NotifPermission> {
  if (Platform.OS === "web") return "unsupported";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return canAskAgain ? "denied" : "blocked";
  return "undetermined";
}

/**
 * Requests permission (if needed), then registers the native device token
 * with the backend relay. Safe to call on every app open; never throws.
 */
export async function registerForPush(userId: string): Promise<NotifPermission> {
  if (Platform.OS === "web") return "unsupported";
  try {
    const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return canAskAgain ? "denied" : "blocked";
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await registerPushToken(userId, String(tokenResp.data));
    return "granted";
  } catch (e) {
    // Expo Go has no native push token; the app keeps working with local alerts.
    console.warn("[push] registration skipped", e);
    return "granted";
  }
}

/** Re-registers the device token on app open without prompting. Tokens rotate; the backend upserts. */
export async function registerForPushIfGranted(userId: string) {
  if (Platform.OS === "web") return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") await registerForPush(userId);
}

export async function sendImpactLocalNotification(clipId: string, speedLabel: string, gForce: number) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Impact detected",
        body: `Clip saved at ${speedLabel} · ${gForce.toFixed(1)}g. Tap to review.`,
        data: { action_url: `/clip/${clipId}` },
        sound: "default",
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("[notif] local notification failed", e);
  }
}
