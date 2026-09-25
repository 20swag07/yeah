import * as Haptics from "expo-haptics";
import React from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  size?: "md" | "lg";
};

export function Button({ label, onPress, variant = "primary", icon, loading, disabled, style, testID, size = "md" }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bg = {
    primary: colors.brandPrimary,
    secondary: colors.surfaceSecondary,
    danger: colors.error,
    ghost: "transparent",
  }[variant];
  const fg = {
    primary: colors.onBrandPrimary,
    secondary: colors.onSurfaceSecondary,
    danger: colors.onError,
    ghost: colors.onSurface,
  }[variant];

  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        size === "lg" && styles.lg,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        variant === "ghost" && styles.ghost,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  lg: { minHeight: 56, borderRadius: radius.lg },
  ghost: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontFamily: fonts.semibold, fontSize: 16 },
}));
