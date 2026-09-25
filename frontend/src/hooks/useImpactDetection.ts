import { Accelerometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { SENSITIVITY_THRESHOLD_G, type ImpactSensitivity } from "@/src/store/settings";

const COOLDOWN_MS = 8000;
const UPDATE_INTERVAL_MS = 50;

/**
 * Watches the accelerometer and fires `onImpact(gForce)` when the deviation
 * from resting gravity exceeds the sensitivity threshold. One trigger per cooldown.
 */
export function useImpactDetection(
  enabled: boolean,
  sensitivity: ImpactSensitivity,
  onImpact: (gForce: number) => void,
) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [currentG, setCurrentG] = useState(0);
  const lastTrigger = useRef(0);
  const callbackRef = useRef(onImpact);
  callbackRef.current = onImpact;

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
      const threshold = SENSITIVITY_THRESHOLD_G[sensitivity];
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const deviation = Math.abs(magnitude - 1);
        // Throttle UI updates to ~4/s; detection itself runs at full rate.
        if (++frame % 5 === 0) setCurrentG(deviation);
        const now = Date.now();
        if (deviation >= threshold && now - lastTrigger.current > COOLDOWN_MS) {
          lastTrigger.current = now;
          callbackRef.current(magnitude);
        }
      });
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, sensitivity]);

  return { available, currentG };
}
