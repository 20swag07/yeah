import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { fonts, makeStyles, spacing, useTheme } from "@/src/theme";

type Props = { title: string; subtitle?: string; action?: React.ReactNode };

/** Abstract geometric illustration — road, horizon, and a signal dot. No photos. */
export function EmptyState({ title, subtitle, action }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} testID="empty-state">
      <Svg width={200} height={140} viewBox="0 0 200 140">
        <Rect x="0" y="0" width="200" height="140" fill={colors.surfaceSecondary} />
        <Line x1="0" y1="60" x2="200" y2="60" stroke={colors.borderStrong} strokeWidth="1.5" />
        <Path d="M 70 140 L 92 60 L 108 60 L 130 140 Z" fill={colors.surfaceTertiary} />
        <Line x1="100" y1="72" x2="100" y2="80" stroke={colors.borderStrong} strokeWidth="2" />
        <Line x1="100" y1="92" x2="100" y2="104" stroke={colors.borderStrong} strokeWidth="2" />
        <Line x1="100" y1="118" x2="100" y2="140" stroke={colors.borderStrong} strokeWidth="2" />
        <Circle cx="160" cy="30" r="10" fill={colors.brandPrimary} />
        <Rect x="24" y="20" width="36" height="20" rx="2" fill={colors.borderStrong} />
        <Rect x="24" y="44" width="20" height="6" rx="1" fill={colors.borderStrong} />
      </Svg>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { alignItems: "center", paddingHorizontal: spacing["2xl"], paddingVertical: spacing["3xl"], gap: spacing.md },
  title: { fontFamily: fonts.semibold, fontSize: 18, color: colors.onSurface, marginTop: spacing.sm, textAlign: "center" },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  action: { marginTop: spacing.sm, alignSelf: "stretch" },
}));
