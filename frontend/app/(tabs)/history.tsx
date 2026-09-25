import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { SectionList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClipRow } from "@/src/components/history/ClipRow";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { formatBytes, formatDayLabel } from "@/src/lib/format";
import { useClips, type Clip } from "@/src/store/clips";
import { useSettings } from "@/src/store/settings";
import { fonts, makeStyles, spacing } from "@/src/theme";

type Filter = "all" | "impact";

export default function HistoryScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const clips = useClips((s) => s.clips);
  const unit = useSettings((s) => s.speedUnit);
  const [filter, setFilter] = useState<Filter>("all");

  const impactCount = useMemo(() => clips.filter((c) => c.impact).length, [clips]);
  const totalBytes = useMemo(() => clips.reduce((a, c) => a + (c.sizeBytes || 0), 0), [clips]);

  const sections = useMemo(() => {
    const list = filter === "impact" ? clips.filter((c) => c.impact) : clips;
    const map = new Map<string, Clip[]>();
    for (const c of list) {
      const key = formatDayLabel(c.recordedAt);
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [clips, filter]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="history-screen">
      <ScreenHeader
        title="History"
        subtitle={clips.length ? `${clips.length} clips · ${impactCount} impacts · ${formatBytes(totalBytes)}` : "Your trips and events"}
      />
      <View style={styles.filter}>
        <SegmentedControl<Filter>
          testID="history-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All clips" },
            { value: "impact", label: impactCount ? `Impacts (${impactCount})` : "Impacts" },
          ]}
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        renderSectionHeader={({ section }) => <Text style={styles.day}>{section.title}</Text>}
        renderItem={({ item, index, section }) => (
          <ClipRow clip={item} unit={unit} last={index === section.data.length - 1} onPress={() => router.push(`/clip/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            title={filter === "impact" ? "No impact events" : "No trips recorded yet"}
            subtitle={
              filter === "impact"
                ? "Impact-flagged clips will appear here automatically."
                : "Start recording from the Record tab. Clips are saved every few minutes and kept on this phone."
            }
          />
        }
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  filter: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  listContent: { paddingBottom: spacing["2xl"] },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  day: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
}));
