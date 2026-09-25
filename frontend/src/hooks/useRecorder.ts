import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import type { CameraView } from "expo-camera";

import type { SpeedSample } from "@/src/hooks/useSpeed";
import { formatSpeed, unitLabel, type SpeedUnit } from "@/src/lib/format";
import { syncClipEvent } from "@/src/services/api";
import { deleteClipFile, getDiskInfo, persistRecording } from "@/src/services/files";
import { sendImpactLocalNotification } from "@/src/services/notifications";
import { makeClipId, useClips, type Clip } from "@/src/store/clips";

export type RecorderStatus = "idle" | "starting" | "recording" | "saving" | "error";

const MIN_FREE_BYTES = 500 * 1024 * 1024;

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
  const pendingImpact = useRef<number | null>(null);
  const segmentStart = useRef(0);
  const speeds = useRef<number[]>([]);
  const addClip = useClips((s) => s.addClip);

  const canRecordVideo = Platform.OS !== "web";

  // Elapsed timer + speed sampling while recording
  useEffect(() => {
    if (status !== "recording") return;
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - segmentStart.current) / 1000));
      const s = lastSample.current;
      if (s) speeds.current.push(s.kmh);
    }, 1000);
    return () => clearInterval(t);
  }, [status, lastSample]);

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
    async (tempUri: string | null, impactG: number | null) => {
      const id = makeClipId();
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

  const loop = useCallback(async () => {
    while (activeRef.current) {
      const cam = cameraRef.current;
      if (!cam) break;
      segmentStart.current = Date.now();
      speeds.current = [];
      setElapsedSec(0);
      setStatus("recording");
      try {
        const result = await cam.recordAsync({ maxDuration: segmentMinutes * 60 });
        if (!activeRef.current && !result?.uri) break;
        setStatus("saving");
        const impactG = pendingImpact.current;
        pendingImpact.current = null;
        await finalizeClip(result?.uri ?? null, impactG);
      } catch (e: any) {
        console.warn("[recorder] segment failed", e);
        setError(e?.message ?? "Recording failed");
        setStatus("error");
        activeRef.current = false;
        return;
      }
    }
    setStatus("idle");
  }, [cameraRef, finalizeClip, segmentMinutes]);

  const start = useCallback(() => {
    if (activeRef.current) return;
    setError(null);
    activeRef.current = true;
    if (!canRecordVideo) {
      // Web preview: no video capture, but the HUD, timer and impact flow still run.
      segmentStart.current = Date.now();
      speeds.current = [];
      setElapsedSec(0);
      setStatus("recording");
      return;
    }
    setStatus("starting");
    loop();
  }, [canRecordVideo, loop]);

  const stop = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    if (canRecordVideo) cameraRef.current?.stopRecording();
    else setStatus("idle");
  }, [cameraRef, canRecordVideo]);

  /** Marks the running segment as an impact clip, saves it immediately and restarts recording. */
  const triggerImpact = useCallback(
    async (gForce: number) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (canRecordVideo && status === "recording" && activeRef.current) {
        pendingImpact.current = gForce;
        cameraRef.current?.stopRecording();
        return;
      }
      // No live video (web / not recording): save a metadata-only event.
      if (!segmentStart.current) segmentStart.current = Date.now();
      await finalizeClip(null, gForce);
      if (!canRecordVideo && activeRef.current) {
        segmentStart.current = Date.now();
        speeds.current = [];
        setElapsedSec(0);
      }
    },
    [cameraRef, canRecordVideo, finalizeClip, status],
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
    setElapsedSec(0);
  }, [cameraRef, canRecordVideo, finalizeClip, status]);

  // Camera unmount / facing switch safety: stop the loop when the camera goes away.
  useEffect(() => {
    if (!cameraReady && activeRef.current && canRecordVideo) {
      activeRef.current = false;
      setStatus("idle");
    }
  }, [cameraReady, canRecordVideo]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (Platform.OS !== "web") cameraRef.current?.stopRecording();
    };
  }, [cameraRef]);

  return { status, elapsedSec, error, lastImpact, start, stop, saveNow, triggerImpact, canRecordVideo };
}
