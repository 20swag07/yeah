import { DownloadSimple, LockSimple, Warning } from "phosphor-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { formatClock, formatDuration, formatSpeed, unitLabel, type SpeedUnit } from "@/src/lib/format";
import type { Clip } from "@/src/store/clips";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

/** Flat geometric thumbnail — no video frame decoding needed, stays crisp in both themes. */
export function ClipThumb({ impact, size = 72, hasVideo = true }: { impact: boolean; size?: number; hasVideo?: boolean }) {
  const { colors } = useTheme();
  const w = size;
  const h = Math.round(size * 0.75);
  const horizon = h * 0.45;
  return (
    <View style={{ width: w, height: h, borderRadius: radius.sm, overflow: "hidden" }}>
      <Svg width={w} height={h}>
        <Rect x="0" y="0" width={w} height={h} fill={colors.feedPlaceholder} />
        <Line x1="0" y1={horizon} x2={w} y2={horizon} stroke={colors.feedPlaceholderLine} strokeWidth="1" />
        <Path d={`M ${w * 0.18} ${h} L ${w * 0.45} ${horizon} L ${w * 0.55} ${horizon} L ${w * 0.82} ${h} Z`} fill={colors.feed} />
        {hasVideo ? <Line x1={w / 2} y1={horizon + 6} x2={w / 2} y2={h} stroke={colors.feedPlaceholderLine} strokeWidth="2" strokeDasharray="3 4" /> : null}
        {impact ? <Rect x="0" y="0" width={w} height="4" fill={colors.error} /> : null}
      </Svg>
    </View>
  );
}

type Props = { clip: Clip; unit: SpeedUnit; onPress: () => void; onDownload?: () => void; last?: boolean };

export function ClipRow({ clip, unit, onPress, onDownload, last }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`clip-row-${clip.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && { backgroundColor: colors.surfaceSecondary }]}
    >
      <ClipThumb impact={clip.impact} hasVideo={!!clip.uri} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.time}>{formatClock(clip.recordedAt)}</Text>
          {clip.impact ? (
            <View style={styles.impactTag}>
              <Warning size={12} color={colors.onError} weight="fill" />
              <Text style={styles.impactText}>IMPACT{clip.gForce ? ` ${clip.gForce.toFixed(1)}g` : ""}</Text>
            </View>
          ) : null}
          {clip.locked && !clip.impact ? <LockSimple size={14} color={colors.muted} weight="fill" /> : null}
        </View>
        <Text style={styles.meta}>
          {formatDuration(clip.durationSec)} · max {formatSpeed(clip.maxSpeedKmh, unit)} {unitLabel(unit)}
          {!clip.uri ? " · no video" : ""}
        </Text>
      </View>
      <Text style={styles.speed}>{formatSpeed(clip.maxSpeedKmh, unit)}</Text>
      {onDownload ? (
        <Pressable
          testID={`clip-download-${clip.id}`}
          accessibilityRole="button"
          accessibilityLabel="Download clip"
          onPress={onDownload}
          disabled={!clip.uri}
          hitSlop={6}
          style={({ pressed }) => [styles.download, !clip.uri && styles.downloadDisabled, pressed && { opacity: 0.5 }]}
        >
          <DownloadSimple size={20} color={colors.onSurface} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  rowLast: { borderBottomWidth: 0 },
  body: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  time: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  impactTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.error,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: radius.sm,
  },
  impactText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, color: colors.onError },
  speed: { fontFamily: fonts.mono, fontSize: 20, color: colors.onSurface, minWidth: 40, textAlign: "right" },
  download: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  downloadDisabled: { opacity: 0.3 },
}));
