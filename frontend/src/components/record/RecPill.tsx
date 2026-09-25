import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { formatDuration } from "@/src/lib/format";
import type { RecorderStatus } from "@/src/hooks/useRecorder";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = { status: RecorderStatus; elapsedSec: number };

export function RecPill({ status, elapsedSec }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pulse = useSharedValue(1);
  const recording = status === "recording";

  useEffect(() => {
    pulse.value = recording
      ? withRepeat(withTiming(0.2, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true)
      : withTiming(1, { duration: 200 });
  }, [recording, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const label = {
    idle: "PAUSED",
    starting: "STARTING",
    recording: "REC",
    saving: "SAVING",
    error: "ERROR",
  }[status];

  const dotColor = recording ? colors.error : status === "error" ? colors.warning : colors.onFeedMuted;

  return (
    <View style={styles.pill} testID="rec-pill">
      <Animated.View style={[styles.dot, { backgroundColor: dotColor }, dotStyle]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.time}>{formatDuration(elapsedSec)}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.feedOverlay,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.pill,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.5, color: colors.onFeed },
  time: { fontFamily: fonts.mono, fontSize: 13, color: colors.onFeed, marginLeft: spacing.xs },
}));
