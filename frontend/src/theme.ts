// Design tokens for this app. Light theme only.Always modify the colors and theme to Dark, Light or Dark and Light according to the design guidelines.
//
// The keys match the "color" block of /app/design_guidelines.json. Fill the
// values from that file (or from the user's brand colors). Keep every key; do
// not add a second theme or colors file; do not write color literals in
// components.
//
// How the names work: a plain key is a background, and its `on` partner is the
// text or icon color that sits on top of it. Always use them as a pair.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//     title: { color: colors.onSurfaceSecondary, fontSize: 16 },
//   }));
//   function Screen() {
//     const styles = useStyles();
//     return <View style={styles.card}><Text style={styles.title}>Hi</Text></View>;
//   }
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.
// Never call StyleSheet.create with color values at module level; it cannot
// follow the scheme.
//
// To support dark mode later: add `dark` to `themes` with every key filled.
// Nothing else changes; the device setting takes over automatically.
// Feel free to add as many new colors as you need to support the design guidelines.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

import { useSettings } from "@/src/store/settings";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#FFFFFF",
  onSurface: "#1A1A1A",
  surfaceSecondary: "#F5F5F5",
  onSurfaceSecondary: "#1A1A1A",
  surfaceTertiary: "#EBEBEB",
  onSurfaceTertiary: "#1A1A1A",
  surfaceInverse: "#1A1A1A",
  onSurfaceInverse: "#FFFFFF",
  muted: "#737373",

  // Brand (monochrome, Revolut-style)
  brand: "#1A1A1A",
  onBrand: "#FFFFFF",
  brandPrimary: "#1A1A1A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F5F5F5",
  onBrandSecondary: "#1A1A1A",
  brandTertiary: "#EBEBEB",
  onBrandTertiary: "#1A1A1A",

  // Status
  success: "#198754",
  onSuccess: "#FFFFFF",
  warning: "#FF9500",
  onWarning: "#1A1A1A",
  error: "#FF3B30",
  onError: "#FFFFFF",
  info: "#1A1A1A",
  onInfo: "#FFFFFF",

  // Lines
  border: "#EBEBEB",
  borderStrong: "#1A1A1A",
  divider: "#EBEBEB",

  // Camera feed chrome: always dark regardless of scheme
  feed: "#000000",
  feedOverlay: "rgba(0,0,0,0.55)",
  onFeed: "#FFFFFF",
  onFeedMuted: "rgba(255,255,255,0.65)",
  feedPlaceholder: "#141414",
  feedPlaceholderLine: "#2A2A2A",
};

const dark: ThemeColors = {
  surface: "#000000",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#141414",
  onSurfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#1F1F1F",
  onSurfaceTertiary: "#FFFFFF",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#000000",
  muted: "#8A8A8A",

  brand: "#FFFFFF",
  onBrand: "#000000",
  brandPrimary: "#FFFFFF",
  onBrandPrimary: "#000000",
  brandSecondary: "#141414",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#1F1F1F",
  onBrandTertiary: "#FFFFFF",

  success: "#30D158",
  onSuccess: "#000000",
  warning: "#FF9F0A",
  onWarning: "#000000",
  error: "#FF453A",
  onError: "#FFFFFF",
  info: "#FFFFFF",
  onInfo: "#000000",

  border: "#1F1F1F",
  borderStrong: "#FFFFFF",
  divider: "#1F1F1F",

  feed: "#000000",
  feedOverlay: "rgba(0,0,0,0.55)",
  onFeed: "#FFFFFF",
  onFeedMuted: "rgba(255,255,255,0.65)",
  feedPlaceholder: "#141414",
  feedPlaceholderLine: "#2A2A2A",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export const fonts = {
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
  mono: "SpaceMono-Regular",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 4, md: 8, lg: 16, pill: 999 };

// In-app theme toggle, only after `dark` exists in `themes`. Call
// setColorScheme("dark"), setColorScheme("light"), or setColorScheme(null) to
// follow the device. Every useTheme() consumer re-renders. Persisting the
// choice and re-applying it on launch is the toggle's job.
export function setColorScheme(scheme: ColorScheme | null) {
  // RN 0.86 re-reads the device scheme only for the literal "unspecified";
  // null would pin useColorScheme() to null and the app to light.
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces (alerts, pickers, navigation chrome) on the schemes this
// app ships: light only forces light; once `dark` exists the device decides.
// Optional call because react-native-web does not implement it.
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  // In-app preference is the source of truth; the device scheme applies only for "system".
  // (Appearance.setColorScheme is a no-op on web, so we cannot rely on it alone.)
  const preference = useSettings((s) => s.theme);
  const wanted = preference === "system" ? system : preference;
  const scheme: ColorScheme = wanted === "light" || wanted === "dark" ? wanted : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}


