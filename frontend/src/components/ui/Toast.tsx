import React, { useEffect } from "react";
import { Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { fonts, makeStyles, radius, spacing } from "@/src/theme";

type Props = { message: string | null; bottom?: number };

/** Minimal inverse-surface toast. Parent controls visibility by passing/clearing `message`. */
export function Toast({ message, bottom = 24 }: Props) {
  const styles = useStyles();
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(message ? 1 : 0, { duration: 180 });
  }, [message, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!message) return null;
  return (
    <Animated.View style={[styles.toast, { bottom }, style]} pointerEvents="none" testID="toast">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

export function useToast(durationMs = 2200) {
  const [message, setMessage] = React.useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs]);
  return { message, show: setMessage };
}

const useStyles = makeStyles((colors) => ({
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  text: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurfaceInverse },
}));
