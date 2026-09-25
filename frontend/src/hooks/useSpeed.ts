import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

export type LocationPermission = "granted" | "denied" | "blocked" | "undetermined" | "loading";

export type SpeedSample = { kmh: number; latitude: number; longitude: number; at: number };

/**
 * Streams GPS speed. Speed in km/h; null until the first fix arrives.
 * Permission flow follows the contract: check → explain → request → settings.
 */
export function useSpeed(enabled: boolean) {
  const [permission, setPermission] = useState<LocationPermission>("loading");
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const lastSample = useRef<SpeedSample | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  const refreshPermission = useCallback(async () => {
    const res = await Location.getForegroundPermissionsAsync();
    if (res.granted) setPermission("granted");
    else if (res.status === "denied") setPermission(res.canAskAgain ? "denied" : "blocked");
    else setPermission("undetermined");
    return res.granted;
  }, []);

  const requestPermission = useCallback(async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    if (res.granted) setPermission("granted");
    else setPermission(res.canAskAgain ? "denied" : "blocked");
    return res.granted;
  }, []);

  useEffect(() => {
    refreshPermission();
  }, [refreshPermission]);

  useEffect(() => {
    if (!enabled || permission !== "granted") {
      subRef.current?.remove();
      subRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (loc) => {
            const raw = loc.coords.speed;
            const kmh = raw === null || raw === undefined || raw < 0 ? 0 : raw * 3.6;
            lastSample.current = {
              kmh,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              at: Date.now(),
            };
            setSpeedKmh(kmh);
          },
        );
        if (cancelled) sub.remove();
        else subRef.current = sub;
      } catch (e) {
        console.warn("[speed] watchPosition failed", e);
      }
    })();
    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled, permission]);

  return { permission, speedKmh, lastSample, requestPermission, refreshPermission };
}
