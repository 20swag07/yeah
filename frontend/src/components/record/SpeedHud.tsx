import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { formatSpeed, type SpeedUnit } from "@/src/lib/format";
import { fonts, makeStyles, radius, spacing } from "@/src/theme";

type Props = {
  speedKmh: number | null;
  unit: SpeedUnit;
  onToggleUnit: (u: SpeedUnit) => void;
  hint?: string | null;
};

export function SpeedHud({ speedKmh, unit, onToggleUnit, hint }: Props) {
  const styles = useStyles();
  const select = (u: SpeedUnit) => {
    if (u === unit) return;
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onToggleUnit(u);
  };
  return (
    <View style={styles.wrap} testID="speed-hud">
      <Text style={styles.speed} testID="speed-value">
        {formatSpeed(speedKmh, unit)}
      </Text>
      <View style={styles.units}>
        {(["kmh", "mph"] as SpeedUnit[]).map((u) => {
          const active = u === unit;
          return (
            <Pressable
              key={u}
              testID={`unit-${u}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => select(u)}
              style={[styles.unit, active && styles.unitActive]}
            >
              <Text style={[styles.unitLabel, active && styles.unitLabelActive]}>{u === "kmh" ? "km/h" : "mph"}</Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { alignItems: "center", gap: spacing.sm },
  speed: {
    fontFamily: fonts.mono,
    fontSize: 84,
    lineHeight: 104,
    letterSpacing: -2,
    color: colors.onFeed,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    textAlign: "center",
  },
  units: {
    flexDirection: "row",
    backgroundColor: colors.feedOverlay,
    borderRadius: radius.pill,
    padding: 3,
  },
  unit: { paddingHorizontal: spacing.lg, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", minWidth: 72 },
  unitActive: { backgroundColor: colors.onFeed },
  unitLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onFeed },
  unitLabelActive: { color: colors.feed },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.onFeedMuted },
}));
