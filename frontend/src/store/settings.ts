import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { SpeedUnit } from "@/src/lib/format";

export type ThemePreference = "system" | "light" | "dark";
export type ImpactSensitivity = "low" | "medium" | "high";
export type SegmentLength = 1 | 3 | 5;

// Threshold, in g above resting gravity, at which a reading counts as an impact.
export const SENSITIVITY_THRESHOLD_G: Record<ImpactSensitivity, number> = {
  low: 3.0,
  medium: 2.2,
  high: 1.5,
};

type SettingsState = {
  deviceId: string;
  speedUnit: SpeedUnit;
  theme: ThemePreference;
  impactSensitivity: ImpactSensitivity;
  segmentMinutes: SegmentLength;
  dualCamera: boolean;
  notificationsEnabled: boolean;
  autoStart: boolean;
  hasSeenOnboarding: boolean;
  setSpeedUnit: (u: SpeedUnit) => void;
  setTheme: (t: ThemePreference) => void;
  setImpactSensitivity: (s: ImpactSensitivity) => void;
  setSegmentMinutes: (m: SegmentLength) => void;
  setDualCamera: (v: boolean) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setAutoStart: (v: boolean) => void;
  setHasSeenOnboarding: (v: boolean) => void;
};

function makeDeviceId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `dev_${Date.now().toString(36)}_${rand()}${rand()}`;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      deviceId: makeDeviceId(),
      speedUnit: "kmh",
      theme: "system",
      impactSensitivity: "medium",
      segmentMinutes: 3,
      dualCamera: false,
      notificationsEnabled: true,
      autoStart: true,
      hasSeenOnboarding: false,
      setSpeedUnit: (speedUnit) => set({ speedUnit }),
      setTheme: (theme) => set({ theme }),
      setImpactSensitivity: (impactSensitivity) => set({ impactSensitivity }),
      setSegmentMinutes: (segmentMinutes) => set({ segmentMinutes }),
      setDualCamera: (dualCamera) => set({ dualCamera }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setAutoStart: (autoStart) => set({ autoStart }),
      setHasSeenOnboarding: (hasSeenOnboarding) => set({ hasSeenOnboarding }),
    }),
    {
      name: "dashcam.settings.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
