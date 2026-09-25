import React from "react";
import { Text, View } from "react-native";

import { fonts, makeStyles, spacing } from "@/src/theme";

type Props = { title: string; subtitle?: string; right?: React.ReactNode };

export function ScreenHeader({ title, subtitle, right }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -0.8, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
}));
