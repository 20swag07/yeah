import React from "react";
import { Linking, Text, View } from "react-native";

import { Button } from "@/src/components/ui/Button";
import { fonts, makeStyles, radius, spacing } from "@/src/theme";

type Props = {
  icon: React.ReactNode;
  title: string;
  body: string;
  /** "blocked" shows Open Settings instead of a request button. */
  blocked?: boolean;
  ctaLabel: string;
  onRequest: () => void;
  secondary?: { label: string; onPress: () => void };
  testID?: string;
};

/** Pre-permission explainer card. Shown before any native prompt and after a denial. */
export function PermissionCard({ icon, title, body, blocked, ctaLabel, onRequest, secondary, testID }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        {blocked ? (
          <Button label="Open Settings" onPress={() => Linking.openSettings()} testID={testID ? `${testID}-settings` : undefined} />
        ) : (
          <Button label={ctaLabel} onPress={onRequest} testID={testID ? `${testID}-cta` : undefined} />
        )}
        {secondary ? <Button label={secondary.label} onPress={secondary.onPress} variant="ghost" /> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    marginHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.4, color: colors.onSurface },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.muted },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
}));
