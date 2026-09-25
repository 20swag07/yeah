import type { GeoPoint, TrackPoint } from "@/src/store/clips";

export type RouteMapProps = {
  track: TrackPoint[];
  impactPoint?: GeoPoint;
  height?: number;
};
