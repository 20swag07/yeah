import React, { useCallback, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import type { RouteMapProps } from "@/src/components/map/RouteMap.types";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

export function RouteMap({ track, impactPoint, height = 220 }: RouteMapProps) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const mapRef = useRef<MapView | null>(null);

  const coords = track.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const start = coords[0];
  const end = coords[coords.length - 1];

  const fit = useCallback(() => {
    const all = impactPoint ? [...coords, { latitude: impactPoint.lat, longitude: impactPoint.lng }] : coords;
    if (all.length === 0) return;
    if (all.length === 1) {
      mapRef.current?.animateToRegion({ ...all[0], latitudeDelta: 0.004, longitudeDelta: 0.004 }, 0);
      return;
    }
    mapRef.current?.fitToCoordinates(all, { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: false });
  }, [coords, impactPoint]);

  return (
    <View style={[styles.wrap, { height }]} testID="route-map">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        onMapReady={fit}
        userInterfaceStyle={scheme}
        mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsTraffic={false}
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {coords.length > 1 ? (
          <Polyline coordinates={coords} strokeColor={colors.onSurface} strokeWidth={4} lineCap="round" lineJoin="round" />
        ) : null}
        {start ? (
          <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.endpoint} />
          </Marker>
        ) : null}
        {end && coords.length > 1 ? (
          <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[styles.endpoint, styles.endpointEnd]} />
          </Marker>
        ) : null}
        {impactPoint ? (
          <Marker coordinate={{ latitude: impactPoint.lat, longitude: impactPoint.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.impactWrap}>
              <View style={styles.impactRing}>
                <View style={styles.impactDot} />
              </View>
              <View style={styles.impactLabel}>
                <Text style={styles.impactLabelText}>Impact</Text>
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { width: "100%", overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  endpoint: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.onSurface,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  endpointEnd: { backgroundColor: colors.surface, borderColor: colors.onSurface },
  impactWrap: { alignItems: "center", gap: 4 },
  impactRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,59,48,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  impactDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.error, borderWidth: 3, borderColor: colors.surface },
  impactLabel: { backgroundColor: colors.error, paddingHorizontal: 8, height: 20, borderRadius: radius.sm, justifyContent: "center" },
  impactLabelText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, color: colors.onError, textTransform: "uppercase" },
}));
