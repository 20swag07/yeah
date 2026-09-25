import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  BellRinging,
  Camera,
  CameraRotate,
  Flag,
  FloppyDisk,
  MapPin,
  Pause,
  Play,
  } from "phosphor-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeedPlaceholder } from "@/src/components/record/FeedPlaceholder";
import { ImpactBanner } from "@/src/components/record/ImpactBanner";
import { PermissionCard } from "@/src/components/record/PermissionCard";
import { RecPill } from "@/src/components/record/RecPill";
import { SpeedHud } from "@/src/components/record/SpeedHud";
import { Button } from "@/src/components/ui/Button";
import { useImpactDetection } from "@/src/hooks/useImpactDetection";
import { useRecorder } from "@/src/hooks/useRecorder";
import { useSpeed } from "@/src/hooks/useSpeed";
import {
  getNotificationPermission,
  registerForPush,
  type NotifPermission,
} from "@/src/services/notifications";
import { useClips } from "@/src/store/clips";
import { useSettings } from "@/src/store/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const isWeb = Platform.OS === "web";

export default function RecordScreen() {
  useKeepAwake();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const speedUnit = useSettings((s) => s.speedUnit);
  const setSpeedUnit = useSettings((s) => s.setSpeedUnit);
  const impactSensitivity = useSettings((s) => s.impactSensitivity);
  const segmentMinutes = useSettings((s) => s.segmentMinutes);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const deviceId = useSettings((s) => s.deviceId);
  const autoStart = useSettings((s) => s.autoStart);
  const clipCount = useClips((s) => s.clips.length);

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotifPermission>("undetermined");
  const [bannerVisible, setBannerVisible] = useState(false);
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);

  const cameraRef = useRef<CameraView | null>(null);
  const autoStarted = useRef(false);
  const resumeAfterReady = useRef(false);
  const [flipping, setFlipping] = useState(false);

  const speed = useSpeed(true);
  const recorder = useRecorder({
    cameraRef,
    cameraReady,
    segmentMinutes,
    facing,
    deviceId,
    speedUnit,
    notificationsEnabled,
    lastSample: speed.lastSample,
  });

  const handleImpact = useCallback(
    (g: number) => {
      recorder.triggerImpact(g);
    },
    [recorder],
  );
  const impact = useImpactDetection(
    recorder.status === "recording",
    impactSensitivity,
    handleImpact,
  );

  // Show the banner whenever a new impact clip lands; auto-hide after 7s.
  useEffect(() => {
    if (!recorder.lastImpact) return;
    setBannerVisible(true);
    const t = setTimeout(() => setBannerVisible(false), 7000);
    return () => clearTimeout(t);
  }, [recorder.lastImpact]);

  useEffect(() => {
    getNotificationPermission().then(setNotifPerm);
  }, []);

  // Auto-start once the camera is live (or immediately in web preview mode).
  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    if (!camPerm?.granted) return;
    if (!isWeb && !cameraReady) return;
    autoStarted.current = true;
    recorder.start();
  }, [autoStart, camPerm?.granted, cameraReady, recorder]);

  // Contextual notification permission: once we are actually recording, explain and ask (once).
  useEffect(() => {
    if (
      !notificationsEnabled ||
      notifPerm !== "undetermined" ||
      recorder.status !== "recording"
    )
      return;
    registerForPush(deviceId).then(setNotifPerm);
  }, [deviceId, notificationsEnabled, notifPerm, recorder.status]);

  const enableCamera = useCallback(async () => {
    const cam = await requestCamPerm();
    if (cam.granted && !micPerm?.granted) await requestMicPerm();
  }, [micPerm?.granted, requestCamPerm, requestMicPerm]);

  const recording =
    recorder.status === "recording" ||
    recorder.status === "starting" ||
    recorder.status === "saving";

  const flipCamera = useCallback(async () => {
    if (flipping) return;
    setFlipping(true);
    const wasActive = recording;
    // Finish + save the running segment before the camera remounts, so no footage is lost.
    await Promise.race([
      recorder.stop(),
      new Promise<void>((r) => setTimeout(r, 3000)),
    ]);
    resumeAfterReady.current = wasActive;
    autoStarted.current = true; // flip handles restart itself
    setCameraReady(false);
    setFacing((f) => (f === "back" ? "front" : "back"));
    setFlipping(false);
  }, [flipping, recorder, recording]);

  // Resume recording after a camera flip once the new camera is live.
  useEffect(() => {
    if (!resumeAfterReady.current || !cameraReady) return;
    resumeAfterReady.current = false;
    recorder.start();
  }, [cameraReady, recorder]);

  // ---- Permission gate -----------------------------------------------------
  const cameraBlocked = camPerm && !camPerm.granted && !camPerm.canAskAgain;
  const showCameraGate = camPerm && !camPerm.granted;

  const speedHint =
    !isWeb && speed.permission !== "granted"
      ? "Location off — enable for live speed"
      : speed.speedKmh === null
        ? "Waiting for GPS…"
        : null;

  return (
    <View style={styles.root} testID="record-screen">
      <StatusBar style="light" />

      {/* Feed */}
      {camPerm?.granted && !cameraError ? (
        <CameraView
          key={facing}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
          mute={!micPerm?.granted}
          videoQuality="1080p"
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => setCameraError(e.message)}
        />
      ) : (
        <FeedPlaceholder
          label={cameraError ? "Camera unavailable" : undefined}
          sublabel={cameraError ?? undefined}
        />
      )}

      {/* Top bar */}
      <View
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <RecPill status={recorder.status} elapsedSec={recorder.elapsedSec} />
        <View style={styles.topActions}>
          {impact.available ? (
            <View style={styles.gPill} testID="g-meter">
              <Text style={styles.gText}>G {impact.currentG.toFixed(2)}</Text>
            </View>
          ) : null}
          <Pressable
            testID="flip-camera"
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
            onPress={flipCamera}
            style={[styles.iconBtn, flipping && styles.disabled]}
            disabled={!camPerm?.granted || flipping}
          >
            <CameraRotate size={22} color={colors.onFeed} />
          </Pressable>
        </View>
      </View>

      {/* Camera permission gate */}
      {showCameraGate ? (
        <View style={styles.gate}>
          <PermissionCard
            testID="camera-permission"
            icon={<Camera size={28} color={colors.onSurface} weight="fill" />}
            title="Turn on the dash cam"
            body={
              cameraBlocked
                ? "Camera access is turned off for this app. Open Settings to allow camera and microphone so recording can start."
                : "Recording needs the camera and microphone. Footage is stored only on this phone — nothing is uploaded."
            }
            blocked={!!cameraBlocked}
            ctaLabel="Enable camera"
            onRequest={enableCamera}
          />
        </View>
      ) : null}

      {/* Location prompt — non-blocking; speed shows "--" until granted */}
      {camPerm?.granted &&
      !isWeb &&
      speed.permission !== "granted" &&
      speed.permission !== "loading" &&
      !locationPromptDismissed ? (
        <View style={styles.locationCard} testID="location-permission">
          <MapPin size={20} color={colors.onSurface} weight="fill" />
          <View style={{ flex: 1 }}>
            <Text style={styles.locationTitle}>Show live speed</Text>
            <Text style={styles.locationBody}>
              Uses GPS while the app is open. Speed is stamped onto every clip.
            </Text>
          </View>
          {speed.permission === "blocked" ? (
            <Button
              label="Settings"
              variant="secondary"
              onPress={() => Linking.openSettings()}
            />
          ) : (
            <Button
              label="Allow"
              onPress={speed.requestPermission}
              testID="location-allow"
            />
          )}
          <Pressable
            onPress={() => setLocationPromptDismissed(true)}
            hitSlop={10}
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.locationDismiss}>Later</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Bottom HUD + controls (hidden while the permission gate is up so its button is always tappable) */}
      {showCameraGate ? null : (
        <View style={styles.bottom} pointerEvents="box-none">
          <SpeedHud
            speedKmh={speed.speedKmh}
            unit={speedUnit}
            onToggleUnit={setSpeedUnit}
            hint={speedHint}
          />

          {recorder.error ? (
            <Text style={styles.errorText} testID="recorder-error">
              {recorder.error}
            </Text>
          ) : null}
          {!recorder.canRecordVideo && recorder.status === "recording" ? (
            <Text style={styles.previewNote} testID="preview-note">
              Preview mode — video capture runs on the mobile app
            </Text>
          ) : null}

          <View style={styles.controls}>
            <Pressable
              testID="save-clip"
              accessibilityRole="button"
              onPress={recorder.saveNow}
              disabled={!recording}
              style={[styles.sideBtn, !recording && styles.disabled]}
            >
              <FloppyDisk size={22} color={colors.onFeed} />
              <Text style={styles.sideLabel}>Save clip</Text>
            </Pressable>

            <Pressable
              testID="toggle-recording"
              accessibilityRole="button"
              onPress={() => (recording ? recorder.stop() : recorder.start())}
              disabled={!camPerm?.granted || flipping}
              style={[
                styles.mainBtn,
                recording ? styles.mainBtnRec : styles.mainBtnIdle,
                !camPerm?.granted && styles.disabled,
              ]}
            >
              {recording ? (
                <Pause size={30} color={colors.onFeed} weight="fill" />
              ) : (
                <Play size={30} color={colors.feed} weight="fill" />
              )}
            </Pressable>

            <Pressable
              testID="mark-event"
              accessibilityRole="button"
              onPress={() => recorder.triggerImpact(0)}
              disabled={!recording}
              style={[styles.sideBtn, !recording && styles.disabled]}
            >
              <Flag size={22} color={colors.onFeed} />
              <Text style={styles.sideLabel}>Mark event</Text>
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText} testID="footer-info">
              {segmentMinutes} min clips · {clipCount} saved
            </Text>
            {notificationsEnabled && notifPerm === "blocked" ? (
              <Pressable
                onPress={() => Linking.openSettings()}
                style={styles.footerAlert}
                accessibilityRole="button"
              >
                <BellRinging size={14} color={colors.warning} />
                <Text style={[styles.footerText, { color: colors.warning }]}>
                  Alerts off
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      <ImpactBanner
        visible={bannerVisible}
        gForce={recorder.lastImpact?.gForce}
        topInset={insets.top}
        onDismiss={() => setBannerVisible(false)}
        onReview={
          recorder.lastImpact
            ? () => {
                setBannerVisible(false);
                router.push(`/clip/${recorder.lastImpact!.clipId}`);
              }
            : undefined
        }
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.feed },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  gPill: {
    backgroundColor: colors.feedOverlay,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  gText: { fontFamily: fonts.mono, fontSize: 12, color: colors.onFeed },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.feedOverlay,
    alignItems: "center",
    justifyContent: "center",
  },
  gate: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    backgroundColor: colors.feedOverlay,
  },
  locationCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    top: "34%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  locationTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.onSurface,
  },
  locationBody: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  locationDismiss: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: spacing.sm,
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
    alignItems: "center",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    alignSelf: "stretch",
  },
  mainBtn: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  mainBtnRec: { backgroundColor: colors.error },
  mainBtnIdle: { backgroundColor: colors.onFeed },
  sideBtn: {
    width: 88,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.feedOverlay,
  },
  sideLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.onFeed },
  disabled: { opacity: 0.35 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.onFeedMuted,
  },
  footerAlert: { flexDirection: "row", alignItems: "center", gap: 4 },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.warning,
    textAlign: "center",
  },
  previewNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.onFeedMuted,
    textAlign: "center",
  },
}));
