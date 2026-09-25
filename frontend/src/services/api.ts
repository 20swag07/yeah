import { Platform } from "react-native";

import type { Clip } from "@/src/store/clips";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL ?? ""}/api`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export function registerPushToken(userId: string, deviceToken: string) {
  return request<{ status: string }>("/register-push", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, platform: Platform.OS, device_token: deviceToken }),
  });
}

/** Mirrors a saved clip's metadata to the backend. Impact events trigger a push from the server. */
export function syncClipEvent(deviceId: string, clip: Clip) {
  return request("/events", {
    method: "POST",
    body: JSON.stringify({
      device_id: deviceId,
      clip_id: clip.id,
      type: clip.impact ? "impact" : "trip",
      recorded_at: clip.recordedAt,
      duration_sec: clip.durationSec,
      max_speed_kmh: clip.maxSpeedKmh,
      avg_speed_kmh: clip.avgSpeedKmh,
      g_force: clip.gForce ?? null,
      latitude: clip.latitude ?? null,
      longitude: clip.longitude ?? null,
      has_video: !!clip.uri,
    }),
  });
}

export function deleteClipEvent(deviceId: string, clipId: string) {
  return request(`/events/${encodeURIComponent(clipId)}?device_id=${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
  });
}

export function deleteAllEvents(deviceId: string) {
  return request(`/events?device_id=${encodeURIComponent(deviceId)}`, { method: "DELETE" });
}
