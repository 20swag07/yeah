import { Warning, X } from "phosphor-react-native";
import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = {
  visible: boolean;
  gForce?: number;
  onDismiss: () => void;
  onReview?: () => void;
  topInset: number;
};

export function ImpactBanner({ visible, gForce, onDismiss, onReview, topInset }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const y = useSharedValue(-160);

  useEffect(() => {
    y.value = visible ? withSpring(0, { damping: 18, stiffness: 180 }) : withTiming(-160, { duration: 220 });
  }, [visible, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View pointerEvents={visible ? "auto" : "none"} style={[styles.banner, { paddingTop: topInset + spacing.sm }, style]} testID="impact-banner">
      <View style={styles.row}>
        <Warning size={26} color={colors.onError} weight="fill" />
        <View style={styles.text}>
          <Text style={styles.title}>Impact detected</Text>
          <Text style={styles.sub}>
            {gForce ? `${gForce.toFixed(1)}g · ` : ""}Clip saved and protected
          </Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss" testID="impact-dismiss">
          <X size={22} color={colors.onError} />
        </Pressable>
      </View>
      {onReview ? (
        <Pressable onPress={onReview} style={styles.review} accessibilityRole="button" testID="impact-review">
          <Text style={styles.reviewLabel}>Review clip</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    zIndex: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.onError },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.onError, opacity: 0.9 },
  review: {
    alignSelf: "flex-start",
    backgroundColor: colors.onError,
    paddingHorizontal: spacing.lg,
    height: 36,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  reviewLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error },
}));
