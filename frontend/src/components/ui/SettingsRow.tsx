import { CaretRight } from "phosphor-react-native";
import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { fonts, makeStyles, spacing, useTheme } from "@/src/theme";

type Props = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  value?: string;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
  testID?: string;
  children?: React.ReactNode;
};

export function SettingsRow({ title, subtitle, icon, value, toggle, onPress, danger, last, testID, children }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const interactive = !!onPress;
  const body = (
    <>
      <View style={[styles.row, last && styles.rowLast]}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <View style={styles.text}>
          <Text style={[styles.title, danger && { color: colors.error }]}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {toggle ? (
          <Switch
            testID={testID ? `${testID}-switch` : undefined}
            value={toggle.value}
            onValueChange={toggle.onChange}
            trackColor={{ false: colors.surfaceTertiary, true: colors.brandPrimary }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.surfaceTertiary}
          />
        ) : null}
        {interactive && !toggle ? <CaretRight size={18} color={colors.muted} /> : null}
      </View>
      {children ? <View style={[styles.childWrap, last && styles.rowLast]}>{children}</View> : null}
    </>
  );
  if (!interactive) return <View testID={testID}>{body}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  );
}

export function SectionHeader({ title }: { title: string }) {
  const styles = useStyles();
  return <Text style={styles.section}>{title}</Text>;
}

export function Group({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.group}>{children}</View>;
}

const useStyles = makeStyles((colors) => ({
  group: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  icon: { width: 28, alignItems: "center" },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  value: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  childWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    marginTop: -spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  section: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
}));
