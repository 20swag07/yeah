import { useRouter, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { ArrowLeft, DownloadSimple, LockSimple, LockSimpleOpen, ShareNetwork, Trash, Warning } from "phosphor-react-native";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClipThumb } from "@/src/components/history/ClipRow";
import { RouteMap } from "@/src/components/map/RouteMap";
import { Button } from "@/src/components/ui/Button";
import { Toast, useToast } from "@/src/components/ui/Toast";
import { formatBytes, formatClock, formatDuration, formatFullDate, formatSpeed, unitLabel } from "@/src/lib/format";
import { deleteClipEvent } from "@/src/services/api";
import { exportMessage, saveClipToPhotos, shareClip } from "@/src/services/export";
import { deleteClipFile } from "@/src/services/files";
import { useClips } from "@/src/store/clips";
import { useSettings } from "@/src/store/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ClipDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const clip = useClips((s) => s.clips.find((c) => c.id === id));
  const removeClip = useClips((s) => s.removeClip);
  const toggleLock = useClips((s) => s.toggleLock);
  const unit = useSettings((s) => s.speedUnit);
  const deviceId = useSettings((s) => s.deviceId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState<"save" | "share" | null>(null);
  const toast = useToast();

  const onSave = async () => {
    setExporting("save");
    const res = await saveClipToPhotos(clip?.uri ?? null);
    setExporting(null);
    const msg = exportMessage(res);
    if (msg) toast.show(msg);
  };
  const onShare = async () => {
    setExporting("share");
    const res = await shareClip(clip?.uri ?? null);
    setExporting(null);
    const msg = exportMessage(res);
    if (msg) toast.show(msg);
  };

  const player = useVideoPlayer(clip?.uri ?? null, (p) => {
    p.loop = true;
  });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/history"));

  const onDelete = () => {
    if (!clip) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteClipFile(clip.uri);
    removeClip(clip.id);
    deleteClipEvent(deviceId, clip.id).catch(() => {});
    goBack();
  };

  const facts = clip
    ? [
        { label: "Duration", value: formatDuration(clip.durationSec) },
        { label: "Max speed", value: `${formatSpeed(clip.maxSpeedKmh, unit)} ${unitLabel(unit)}` },
        { label: "Avg speed", value: `${formatSpeed(clip.avgSpeedKmh, unit)} ${unitLabel(unit)}` },
        { label: "Impact force", value: clip.gForce ? `${clip.gForce.toFixed(2)} g` : "—" },
        ...(clip.impactMode ? [{ label: "Detected while", value: clip.impactMode === "driving" ? "Driving" : "Parked" }] : []),
        { label: "Camera", value: clip.camera === "back" ? "Rear" : "Front" },
        { label: "File size", value: clip.uri ? formatBytes(clip.sizeBytes) : "No video" },
        ...(clip.latitude !== undefined && clip.longitude !== undefined
          ? [{ label: "Location", value: `${clip.latitude.toFixed(4)}, ${clip.longitude.toFixed(4)}` }]
          : []),
      ]
    : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="clip-detail">
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back" testID="clip-back">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{clip ? formatClock(clip.recordedAt) : "Clip"}</Text>
          {clip ? <Text style={styles.subtitle}>{formatFullDate(clip.recordedAt)}</Text> : null}
        </View>
        {clip ? (
          <Pressable onPress={() => toggleLock(clip.id)} style={styles.back} accessibilityRole="button" accessibilityLabel={clip.locked ? "Unlock clip" : "Protect clip"} testID="clip-lock">
            {clip.locked ? <LockSimple size={22} color={colors.onSurface} weight="fill" /> : <LockSimpleOpen size={22} color={colors.muted} />}
          </Pressable>
        ) : null}
      </View>

      {!clip ? (
        <View style={styles.missing}>
          <Text style={styles.missingText}>This clip is no longer available.</Text>
          <Button label="Back to history" onPress={goBack} variant="secondary" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.player}>
            {clip.uri ? (
              <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls testID="clip-video" />
            ) : (
              <View style={styles.noVideo}>
                <ClipThumb impact={clip.impact} size={160} hasVideo={false} />
                <Text style={styles.noVideoText}>
                  {Platform.OS === "web" ? "Event captured in preview mode — no video file" : "No video was saved for this event"}
                </Text>
              </View>
            )}
          </View>

          {clip.impact ? (
            <View style={styles.impactBar} testID="clip-impact-badge">
              <Warning size={18} color={colors.onError} weight="fill" />
              <Text style={styles.impactText}>Impact event · protected from automatic cleanup</Text>
            </View>
          ) : null}

          <View style={styles.exportRow}>
            <Button
              testID="clip-download"
              label="Download"
              variant="primary"
              icon={<DownloadSimple size={18} color={colors.onBrandPrimary} />}
              onPress={onSave}
              loading={exporting === "save"}
              disabled={!clip.uri}
              style={styles.exportBtn}
            />
            <Button
              testID="clip-share"
              label="Share"
              variant="secondary"
              icon={<ShareNetwork size={18} color={colors.onSurfaceSecondary} />}
              onPress={onShare}
              loading={exporting === "share"}
              disabled={!clip.uri}
              style={styles.exportBtn}
            />
          </View>

          <Text style={styles.sectionTitle}>Route</Text>
          {clip.track && clip.track.length > 0 ? (
            <RouteMap track={clip.track} impactPoint={clip.impactPoint} height={240} />
          ) : (
            <View style={styles.noRoute} testID="no-route">
              <Text style={styles.noRouteText}>No GPS route was recorded for this clip.</Text>
            </View>
          )}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={styles.legendStart} />
              <Text style={styles.legendText}>Start</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendEnd} />
              <Text style={styles.legendText}>End</Text>
            </View>
            {clip.impactPoint ? (
              <View style={styles.legendItem}>
                <View style={styles.legendImpact} />
                <Text style={styles.legendText}>Impact</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.facts}>
            {facts.map((f, i) => (
              <View key={f.label} style={[styles.fact, i === facts.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.factLabel}>{f.label}</Text>
                <Text style={styles.factValue}>{f.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              testID="clip-delete"
              label={confirmDelete ? "Confirm delete" : "Delete clip"}
              variant={confirmDelete ? "danger" : "secondary"}
              icon={<Trash size={18} color={confirmDelete ? colors.onError : colors.onSurfaceSecondary} />}
              onPress={onDelete}
            />
            {confirmDelete ? <Button label="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} /> : null}
          </View>
        </ScrollView>
      )}
      <Toast message={toast.message} bottom={insets.bottom + 24} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  content: { paddingBottom: spacing["3xl"] },
  player: { aspectRatio: 16 / 9, backgroundColor: colors.feed, width: "100%" },
  noVideo: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  noVideoText: { fontFamily: fonts.regular, fontSize: 13, color: colors.onFeedMuted, textAlign: "center" },
  impactBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.error, paddingHorizontal: spacing.lg, height: 44 },
  impactText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onError },
  facts: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  factLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  factValue: { fontFamily: fonts.mono, fontSize: 15, color: colors.onSurface },
  actions: { padding: spacing.lg, gap: spacing.sm },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl },
  missingText: { fontFamily: fonts.medium, fontSize: 16, color: colors.muted },
  exportRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg },
  exportBtn: { flex: 1 },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  noRoute: { height: 120, marginHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  noRouteText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  legend: { flexDirection: "row", gap: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendStart: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onSurface },
  legendEnd: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.onSurface },
  legendImpact: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
}));
