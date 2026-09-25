import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Clip = {
  id: string;
  /** Local file URI. Null when the event was captured without video (e.g. web preview). */
  uri: string | null;
  recordedAt: string; // ISO — when the segment started
  durationSec: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  impact: boolean;
  gForce?: number;
  sizeBytes: number;
  camera: "back" | "front";
  latitude?: number;
  longitude?: number;
  /** Protected clips are never removed by automatic storage cleanup. */
  locked: boolean;
};

type ClipsState = {
  clips: Clip[];
  hydrated: boolean;
  addClip: (clip: Clip) => void;
  removeClip: (id: string) => void;
  toggleLock: (id: string) => void;
  clearAll: () => void;
  setHydrated: (v: boolean) => void;
};

export const useClips = create<ClipsState>()(
  persist(
    (set) => ({
      clips: [],
      hydrated: false,
      addClip: (clip) => set((s) => ({ clips: [clip, ...s.clips] })),
      removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),
      toggleLock: (id) =>
        set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)) })),
      clearAll: () => set({ clips: [] }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "dashcam.clips.v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ clips: s.clips }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);

export function makeClipId(): string {
  return `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
