import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { fonts, makeStyles, spacing, useTheme } from "@/src/theme";

type Props = { label?: string; sublabel?: string };

/** Full-bleed abstract "road" placeholder used when no live camera feed is available. */
export function FeedPlaceholder({ label, sublabel }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const horizon = height * 0.42;
  return (
    <View style={styles.wrap} testID="feed-placeholder">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect x="0" y="0" width={width} height={height} fill={colors.feedPlaceholder} />
        <Line x1="0" y1={horizon} x2={width} y2={horizon} stroke={colors.feedPlaceholderLine} strokeWidth="1.5" />
        <Path
          d={`M ${width * 0.12} ${height} L ${width * 0.46} ${horizon} L ${width * 0.54} ${horizon} L ${width * 0.88} ${height} Z`}
          fill={colors.feed}
        />
        {[0.08, 0.2, 0.34, 0.52, 0.74].map((t, i) => {
          const y1 = horizon + (height - horizon) * t;
          const y2 = horizon + (height - horizon) * (t + 0.06 + i * 0.01);
          return <Line key={t} x1={width / 2} y1={y1} x2={width / 2} y2={y2} stroke={colors.feedPlaceholderLine} strokeWidth={2 + i} />;
        })}
        {[0.25, 0.5, 0.75].map((t) => (
          <Line key={t} x1={0} y1={horizon * t} x2={width} y2={horizon * t} stroke={colors.feedPlaceholderLine} strokeWidth="0.5" opacity={0.6} />
        ))}
      </Svg>
      {label ? (
        <View style={styles.labelWrap}>
          <Text style={styles.label}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  labelWrap: { alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.xl, marginTop: -spacing["3xl"] },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onFeed, textAlign: "center" },
  sublabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.onFeedMuted, textAlign: "center" },
}));
