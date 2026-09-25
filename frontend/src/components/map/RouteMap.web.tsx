import React, { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";

import type { RouteMapProps } from "@/src/components/map/RouteMap.types";
import { fonts, makeStyles, radius, useTheme } from "@/src/theme";

/** Web fallback: a flat, schematic route drawing (no map tiles available on web). */
export function RouteMap({ track, impactPoint, height = 220 }: RouteMapProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const pts = track.map((p) => ({ lat: p.lat, lng: p.lng }));
  const all = impactPoint ? [...pts, impactPoint] : pts;
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 36;
  const spanLat = Math.max(maxLat - minLat, 0.0005);
  const spanLng = Math.max(maxLng - minLng, 0.0005);
  const scale = Math.min((width - pad * 2) / spanLng, (height - pad * 2) / spanLat);
  const project = (p: { lat: number; lng: number }) => ({
    x: pad + (p.lng - minLng) * scale + ((width - pad * 2) - spanLng * scale) / 2,
    y: pad + (maxLat - p.lat) * scale + ((height - pad * 2) - spanLat * scale) / 2,
  });

  const projected = width ? pts.map(project) : [];
  const impact = width && impactPoint ? project(impactPoint) : null;
  const gridLines = [0.25, 0.5, 0.75];

  return (
    <View style={[styles.wrap, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID="route-map">
      {width ? (
        <Svg width={width} height={height}>
          <Rect x="0" y="0" width={width} height={height} fill={colors.surfaceSecondary} />
          {gridLines.map((g) => (
            <React.Fragment key={g}>
              <Line x1={width * g} y1={0} x2={width * g} y2={height} stroke={colors.border} strokeWidth="1" />
              <Line x1={0} y1={height * g} x2={width} y2={height * g} stroke={colors.border} strokeWidth="1" />
            </React.Fragment>
          ))}
          {projected.length > 1 ? (
            <Polyline
              points={projected.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={colors.onSurface}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {projected[0] ? <Circle cx={projected[0].x} cy={projected[0].y} r="7" fill={colors.onSurface} stroke={colors.surface} strokeWidth="3" /> : null}
          {projected.length > 1 ? (
            <Circle cx={projected[projected.length - 1].x} cy={projected[projected.length - 1].y} r="7" fill={colors.surface} stroke={colors.onSurface} strokeWidth="3" />
          ) : null}
          {impact ? (
            <>
              <Circle cx={impact.x} cy={impact.y} r="13" fill={colors.error} opacity={0.25} />
              <Circle cx={impact.x} cy={impact.y} r="7" fill={colors.error} stroke={colors.surface} strokeWidth="3" />
            </>
          ) : null}
        </Svg>
      ) : null}
      {impact ? (
        <View style={[styles.impactLabel, { left: Math.min(Math.max(impact.x - 26, 4), width - 56), top: Math.min(impact.y + 14, height - 26) }]}>
          <Text style={styles.impactLabelText}>Impact</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { width: "100%", overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  impactLabel: { position: "absolute", backgroundColor: colors.error, paddingHorizontal: 8, height: 20, borderRadius: radius.sm, justifyContent: "center" },
  impactLabelText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, color: colors.onError, textTransform: "uppercase" },
}));
