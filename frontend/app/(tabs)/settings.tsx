import Constants from "expo-constants";
import { Bell, Clock, Gauge, HardDrive, Moon, Trash, Warning } from "phosphor-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Group, SectionHeader, SettingsRow } from "@/src/components/ui/SettingsRow";
import { formatBytes, type SpeedUnit } from "@/src/lib/format";
import { deleteAllEvents } from "@/src/services/api";
import { deleteClipFile, getDiskInfo } from "@/src/services/files";
import { getNotificationPermission, registerForPush, type NotifPermission } from "@/src/services/notifications";
import { useClips } from "@/src/store/clips";
import { DRIVING_THRESHOLD_G, PARKED_THRESHOLD_G, useSettings, type ImpactSensitivity, type SegmentLength, type ThemePreference } from "@/src/store/settings";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function SettingsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useSettings();
  const clips = useClips((st) => st.clips);
  const clearAll = useClips((st) => st.clearAll);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotifPermission>("undetermined");

  useEffect(() => {
    getNotificationPermission().then(setNotifPerm);
  }, []);

  const usedBytes = useMemo(() => clips.reduce((a, c) => a + (c.sizeBytes || 0), 0), [clips]);
  const disk = getDiskInfo();
  const usedRatio = disk.total ? Math.min(1, (disk.total - disk.available) / disk.total) : 0;

  const onToggleNotifications = async (v: boolean) => {
    s.setNotificationsEnabled(v);
    if (v && notifPerm !== "granted") {
      const res = await registerForPush(s.deviceId);
      setNotifPerm(res);
    }
  };

  const deleteEverything = () => {
    for (const c of clips) deleteClipFile(c.uri);
    clearAll();
    deleteAllEvents(s.deviceId).catch(() => {});
    setConfirmDelete(false);
  };

  const notifSubtitle =
    Platform.OS === "web"
      ? "Available on the mobile app"
      : notifPerm === "blocked"
        ? "Turned off in system settings"
        : notifPerm === "denied"
          ? "Permission not granted yet"
          : "Local alert + push when an impact is detected";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
      testID="settings-screen"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Settings" subtitle="Dash cam preferences" />

      <SectionHeader title="Preferences" />
      <Group>
        <SettingsRow title="Speed unit" icon={<Gauge size={22} color={colors.onSurface} />} testID="setting-speed-unit">
          <SegmentedControl<SpeedUnit>
            testID="speed-unit"
            value={s.speedUnit}
            onChange={s.setSpeedUnit}
            options={[
              { value: "kmh", label: "km/h" },
              { value: "mph", label: "mph" },
            ]}
          />
        </SettingsRow>
        <SettingsRow title="Appearance" icon={<Moon size={22} color={colors.onSurface} />} last testID="setting-theme">
          <SegmentedControl<ThemePreference>
            testID="theme"
            value={s.theme}
            onChange={s.setTheme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </SettingsRow>
      </Group>

      <SectionHeader title="Recording" />
      <Group>
        <SettingsRow title="Clip length" subtitle="Footage is saved in segments" icon={<Clock size={22} color={colors.onSurface} />} testID="setting-clip-length">
          <SegmentedControl<SegmentLength>
            testID="clip-length"
            value={s.segmentMinutes}
            onChange={s.setSegmentMinutes}
            options={[
              { value: 1, label: "1 min" },
              { value: 3, label: "3 min" },
              { value: 5, label: "5 min" },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          title="Auto-start recording"
          subtitle="Begin recording when the app opens"
          toggle={{ value: s.autoStart, onChange: s.setAutoStart }}
          last
          testID="setting-autostart"
        />
      </Group>

      <SectionHeader title="Safety" />
      <Group>
        <SettingsRow
          title="Impact sensitivity"
          subtitle={`Parked: above ${PARKED_THRESHOLD_G[s.impactSensitivity].toFixed(1)}g · Driving: above ${DRIVING_THRESHOLD_G[s.impactSensitivity].toFixed(1)}g. Small bumps count while parked; on the road only a crash-level force triggers.`}
          icon={<Warning size={22} color={colors.onSurface} />}
          testID="setting-sensitivity"
        >
          <SegmentedControl<ImpactSensitivity>
            testID="sensitivity"
            value={s.impactSensitivity}
            onChange={s.setImpactSensitivity}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          title="Impact alerts"
          subtitle={notifSubtitle}
          icon={<Bell size={22} color={colors.onSurface} />}
          toggle={{ value: s.notificationsEnabled, onChange: onToggleNotifications }}
          last={notifPerm !== "blocked"}
          testID="setting-notifications"
        />
        {notifPerm === "blocked" ? (
          <SettingsRow title="Open system settings" subtitle="Allow notifications for this app" onPress={() => Linking.openSettings()} last />
        ) : null}
      </Group>

      <SectionHeader title="Storage" />
      <Group>
        <SettingsRow title="Clips on this phone" icon={<HardDrive size={22} color={colors.onSurface} />} value={formatBytes(usedBytes)} testID="setting-storage">
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.max(2, usedRatio * 100)}%` }]} />
          </View>
          <Text style={styles.barLabel}>
            {disk.total
              ? `${formatBytes(disk.available)} free of ${formatBytes(disk.total)} · oldest unlocked clips are removed automatically when space runs low`
              : `${clips.length} clips saved · storage details available on the mobile app`}
          </Text>
        </SettingsRow>
        <SettingsRow
          title={confirmDelete ? "Tap again to delete everything" : "Delete all clips"}
          subtitle={confirmDelete ? "This cannot be undone" : "Removes every clip, including protected ones"}
          icon={<Trash size={22} color={colors.error} />}
          onPress={() => (confirmDelete ? deleteEverything() : setConfirmDelete(true))}
          danger
          last
          testID="delete-all"
        />
      </Group>
      {confirmDelete ? (
        <View style={styles.cancelWrap}>
          <Button label="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
        </View>
      ) : null}

      <Text style={styles.about}>
        Dash Cam {Constants.expoConfig?.version ?? "1.0.0"} · Device {s.deviceId.slice(-8)}
      </Text>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing["3xl"] },
  barTrack: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, overflow: "hidden", marginTop: spacing.xs },
  barFill: { height: "100%", backgroundColor: colors.brandPrimary },
  barLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: spacing.sm, lineHeight: 17 },
  cancelWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  about: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: "center", paddingTop: spacing["2xl"] },
}));
