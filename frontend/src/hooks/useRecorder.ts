import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import type { CameraView } from "expo-camera";

import type { SpeedSample } from "@/src/hooks/useSpeed";
import { formatSpeed, unitLabel, type SpeedUnit } from "@/src/lib/format";
import { syncClipEvent } from "@/src/services/api";
import { deleteClipFile, getDiskInfo, persistRecording } from "@/src/services/files";
import { sendImpactLocalNotification } from "@/src/services/notifications";
import { makeClipId, useClips, type Clip, type GeoPoint, type ImpactMode, type TrackPoint } from "@/src/store/clips";

export type RecorderStatus = "idle" | "starting" | "recording" | "saving" | "error";

const MIN_FREE_BYTES = 500 * 1024 * 1024;
const MAX_TRACK_POINTS = 900;

type PendingImpact = { gForce: number; mode: ImpactMode; point?: GeoPoint };

type Options = {
  cameraRef: React.RefObject<CameraView | null>;
  cameraReady: boolean;
  segmentMinutes: number;
  facing: "back" | "front";
  deviceId: string;
  speedUnit: SpeedUnit;
  notificationsEnabled: boolean;
  lastSample: React.MutableRefObject<SpeedSample | null>;
};

export function useRecorder(opts: Options) {
  const { cameraRef, cameraReady, segmentMinutes, facing, deviceId, speedUnit, notificationsEnabled, lastSample } =
    opts;
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastImpact, setLastImpact] = useState<{ clipId: string; gForce: number; at: number } | null>(null);

  const activeRef = useRef(false);
  const gen = useRef(0);
  const stopResolvers = useRef<(() => void)[]>([]);
  const cameraReadyRef = useRef(cameraReady);
  cameraReadyRef.current = cameraReady;
  const pendingImpact = useRef<PendingImpact | null>(null);
  const segmentStart = useRef(0);
  const tripStart = useRef(0);
  const [holdingTrip, setHoldingTrip] = useState(false);
  const speeds = useRef<number[]>([]);
  const track = useRef<TrackPoint[]>([]);
  const addClip = useClips((s) => s.addClip);

  const canRecordVideo = Platform.OS !== "web";

  // Trip timer (keeps counting across segments and camera flips) + speed/route sampling.
  useEffect(() => {
    const running = status !== "idle" && status !== "error";
    if (!running && !holdingTrip) return;
    const t = setInterval(() => {
      if (tripStart.current) setElapsedSec(Math.floor((Date.now() - tripStart.current) / 1000));
      if (status !== "recording") return;
      const s = lastSample.current;
      if (!s) return;
      speeds.current.push(s.kmh);
      const pts = track.current;
      const last = pts[pts.length - 1];
      const moved = !last || Math.abs(last.lat - s.latitude) > 0.00002 || Math.abs(last.lng - s.longitude) > 0.00002;
      if (moved && pts.length < MAX_TRACK_POINTS) {
        pts.push({
          lat: s.latitude,
          lng: s.longitude,
          t: Math.round((Date.now() - segmentStart.current) / 1000),
          kmh: Math.round(s.kmh),
        });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [status, holdingTrip, lastSample]);

  const freeUpSpaceIfNeeded = useCallback(() => {
    const { available, total } = getDiskInfo();
    if (!total || available > MIN_FREE_BYTES) return;
    const { clips, removeClip } = useClips.getState();
    const oldest = [...clips].reverse().find((c) => !c.locked && !c.impact && c.uri);
    if (oldest) {
      deleteClipFile(oldest.uri);
      removeClip(oldest.id);
    }
  }, []);

  const finalizeClip = useCallback(
    async (tempUri: string | null, impact: PendingImpact | null) => {
      const id = makeClipId();
      const impactG = impact ? impact.gForce : null;
      const durationSec = Math.max(1, Math.round((Date.now() - segmentStart.current) / 1000));
      const samples = speeds.current;
      const maxSpeedKmh = samples.length ? Math.max(...samples) : lastSample.current?.kmh ?? 0;
      const avgSpeedKmh = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : maxSpeedKmh;
      let uri: string | null = null;
      let sizeBytes = 0;
      if (tempUri) {
        const saved = await persistRecording(tempUri, id);
        uri = saved.uri;
        sizeBytes = saved.sizeBytes;
      }
      const clip: Clip = {
        id,
        uri,
        recordedAt: new Date(segmentStart.current).toISOString(),
        durationSec,
        maxSpeedKmh,
        avgSpeedKmh,
        impact: impactG !== null,
        gForce: impactG ?? undefined,
        sizeBytes,
        camera: facing,
        latitude: lastSample.current?.latitude,
        longitude: lastSample.current?.longitude,
        track: track.current.length ? [...track.current] : undefined,
        impactPoint: impact?.point,
        impactMode: impact?.mode,
        locked: impactG !== null,
      };
      addClip(clip);
      freeUpSpaceIfNeeded();

      if (impactG !== null) {
        setLastImpact({ clipId: id, gForce: impactG, at: Date.now() });
        const speedLabel = `${formatSpeed(maxSpeedKmh, speedUnit)} ${unitLabel(speedUnit)}`;
        if (notificationsEnabled) sendImpactLocalNotification(id, speedLabel, impactG);
      }
      // Mirror metadata to the backend; impact events trigger a push server-side.
      syncClipEvent(deviceId, clip).catch((e) => console.warn("[sync] event failed", e));
      return clip;
    },
    [addClip, deviceId, facing, freeUpSpaceIfNeeded, lastSample, notificationsEnabled, speedUnit],
  );

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const finishStop = useCallback(() => {
    const resolvers = stopResolvers.current;
    stopResolvers.current = [];
    resolvers.forEach((r) => r());
  }, []);

  /** Waits (bounded) until the camera view reports ready. Returns false if superseded/stopped. */
  const waitForCamera = useCallback(
    async (myGen: number) => {
      for (let i = 0; i < 100; i++) {
        if (!activeRef.current || gen.current !== myGen) return false;
        if (cameraReadyRef.current && cameraRef.current) return true;
        await sleep(100);
      }
      return !!(cameraReadyRef.current && cameraRef.current);
    },
    [cameraRef],
  );

  const loop = useCallback(
    async (myGen: number) => {
      let failures = 0;
      const ready = await waitForCamera(myGen);
      if (gen.current !== myGen) return;
      if (!ready) {
        setError("Camera is not ready. Try again.");
        setStatus("error");
        activeRef.current = false;
        finishStop();
        return;
      }
      while (activeRef.current && gen.current === myGen) {
        const cam = cameraRef.current;
        if (!cam) {
          await sleep(200);
          continue;
        }
        segmentStart.current = Date.now();
        speeds.current = [];
        track.current = [];
        setStatus("recording");
        let result: { uri: string } | undefined;
        try {
          result = await cam.recordAsync({ maxDuration: segmentMinutes * 60 });
        } catch (e: any) {
          if (gen.current !== myGen) return;
          console.warn("[recorder] segment failed", e);
          if (!activeRef.current) break; // stopped mid-flight: exit quietly
          failures += 1;
          setError(e?.message ?? "Recording failed");
          if (failures >= 4) {
            setStatus("error");
            activeRef.current = false;
            finishStop();
            return;
          }
          await sleep(700 * failures);
          continue;
        }
        if (gen.current !== myGen) return;
        failures = 0;
        setError(null);
        const impact = pendingImpact.current;
        pendingImpact.current = null;
        if (result?.uri || impact) {
          setStatus("saving");
          await finalizeClip(result?.uri ?? null, impact);
        }
      }
      if (gen.current === myGen) setStatus("idle");
      finishStop();
    },
    [cameraRef, finalizeClip, finishStop, segmentMinutes, waitForCamera],
  );

  const start = useCallback(() => {
    if (activeRef.current) return;
    setError(null);
    activeRef.current = true;
    const myGen = ++gen.current;
    if (!holdingTrip) {
      tripStart.current = Date.now();
      setElapsedSec(0);
    }
    setHoldingTrip(false);
    if (!canRecordVideo) {
      // Web preview: no video capture, but the HUD, timer and impact flow still run.
      segmentStart.current = Date.now();
      speeds.current = [];
      track.current = [];
      setStatus("recording");
      return;
    }
    setStatus("starting");
    loop(myGen);
  }, [canRecordVideo, holdingTrip, loop]);

  /**
   * Stops recording. Resolves once the current segment has been saved and the loop has exited.
   * `keepTrip` keeps the trip timer running (used while switching cameras, so the trip continues).
   */
  const stop = useCallback((opts?: { keepTrip?: boolean }): Promise<void> => {
    if (!activeRef.current) return Promise.resolve();
    activeRef.current = false;
    if (opts?.keepTrip) setHoldingTrip(true);
    else {
      setHoldingTrip(false);
      tripStart.current = 0;
    }
    if (!canRecordVideo) {
      setStatus("idle");
      return Promise.resolve();
    }
    const done = new Promise<void>((resolve) => stopResolvers.current.push(resolve));
    cameraRef.current?.stopRecording();
    return done;
  }, [cameraRef, canRecordVideo]);

  /** Marks the running segment as an impact clip, saves it immediately and restarts recording. */
  const triggerImpact = useCallback(
    async (gForce: number, mode: ImpactMode = "parked") => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const s = lastSample.current;
      const impact: PendingImpact = { gForce, mode, point: s ? { lat: s.latitude, lng: s.longitude } : undefined };
      if (canRecordVideo && status === "recording" && activeRef.current) {
        pendingImpact.current = impact;
        cameraRef.current?.stopRecording();
        return;
      }
      // No live video (web / not recording): save a metadata-only event.
      if (!segmentStart.current) segmentStart.current = Date.now();
      await finalizeClip(null, impact);
      if (!canRecordVideo && activeRef.current) {
        segmentStart.current = Date.now();
        speeds.current = [];
        track.current = [];
      }
    },
    [cameraRef, canRecordVideo, finalizeClip, lastSample, status],
  );

  /** Ends the running segment early (unflagged) and continues with a fresh one. */
  const saveNow = useCallback(async () => {
    if (!activeRef.current) return;
    if (canRecordVideo) {
      if (status === "recording") cameraRef.current?.stopRecording();
      return;
    }
    await finalizeClip(null, null);
    segmentStart.current = Date.now();
    speeds.current = [];
    track.current = [];
  }, [cameraRef, canRecordVideo, finalizeClip, status]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      gen.current += 1;
      if (Platform.OS !== "web") cameraRef.current?.stopRecording();
    };
  }, [cameraRef]);

  return { status, elapsedSec, error, lastImpact, start, stop, saveNow, triggerImpact, canRecordVideo };
}
