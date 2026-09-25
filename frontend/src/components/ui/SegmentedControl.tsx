import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { fonts, makeStyles, radius, spacing } from "@/src/theme";

type Option<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
};

export function SegmentedControl<T extends string | number>({ options, value, onChange, testID }: Props<T>) {
  const styles = useStyles();
  return (
    <View style={styles.track} testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            testID={testID ? `${testID}-${o.value}` : undefined}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  track: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md - 2,
    paddingHorizontal: spacing.sm,
  },
  segmentActive: { backgroundColor: colors.brandPrimary },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurfaceTertiary },
  labelActive: { color: colors.onBrandPrimary, fontFamily: fonts.semibold },
}));
