import { Accelerometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import type { ImpactMode } from "@/src/store/clips";
import { DRIVING_SPEED_KMH, DRIVING_THRESHOLD_G, PARKED_THRESHOLD_G, type ImpactSensitivity } from "@/src/store/settings";

const COOLDOWN_MS = 8000;
const UPDATE_INTERVAL_MS = 50;

export function impactThreshold(sensitivity: ImpactSensitivity, mode: ImpactMode): number {
  return mode === "driving" ? DRIVING_THRESHOLD_G[sensitivity] : PARKED_THRESHOLD_G[sensitivity];
}

/**
 * Watches the accelerometer and fires `onImpact(gForce, mode)` when the deviation from resting
 * gravity exceeds the threshold for the current mode. Parked cars use the sensitive threshold;
 * while driving (speed above DRIVING_SPEED_KMH) a much higher force is required so potholes and
 * hard braking are ignored. One trigger per cooldown.
 */
export function useImpactDetection(
  enabled: boolean,
  sensitivity: ImpactSensitivity,
  getSpeedKmh: () => number | null,
  onImpact: (gForce: number, mode: ImpactMode) => void,
) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [currentG, setCurrentG] = useState(0);
  const [mode, setMode] = useState<ImpactMode>("parked");
  const lastTrigger = useRef(0);
  const callbackRef = useRef(onImpact);
  callbackRef.current = onImpact;
  const speedRef = useRef(getSpeedKmh);
  speedRef.current = getSpeedKmh;

  // Mode follows speed even when the accelerometer is unavailable (web) so the UI stays truthful.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      const kmh = speedRef.current() ?? 0;
      setMode(kmh >= DRIVING_SPEED_KMH ? "driving" : "parked");
    }, 1000);
    return () => clearInterval(t);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") {
      if (Platform.OS === "web") setAvailable(false);
      return;
    }
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    let frame = 0;

    (async () => {
      const ok = await Accelerometer.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      setAvailable(ok);
      if (!ok) return;
      Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const deviation = Math.abs(magnitude - 1);
        // Throttle UI updates to ~4/s; detection itself runs at full rate.
        if (++frame % 5 === 0) setCurrentG(deviation);
        const kmh = speedRef.current() ?? 0;
        const currentMode: ImpactMode = kmh >= DRIVING_SPEED_KMH ? "driving" : "parked";
        const threshold = impactThreshold(sensitivity, currentMode);
        const now = Date.now();
        if (deviation >= threshold && now - lastTrigger.current > COOLDOWN_MS) {
          lastTrigger.current = now;
          callbackRef.current(magnitude, currentMode);
        }
      });
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, sensitivity]);

  return { available, currentG, mode, threshold: impactThreshold(sensitivity, mode) };
}
