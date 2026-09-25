import * as Sharing from "expo-sharing";
import { Alert, Linking, Platform } from "react-native";

// expo-media-library has no web implementation; load it lazily on native only.
type MediaLibrary = typeof import("expo-media-library");
function mediaLibrary(): MediaLibrary {
  return require("expo-media-library") as MediaLibrary;
}

export type ExportResult = "saved" | "shared" | "denied" | "blocked" | "unavailable" | "error";

/** Follows the permission contract: check → request (max once more if allowed) → Open Settings. */
async function ensurePhotosWriteAccess(): Promise<"granted" | "denied" | "blocked"> {
  const { getPermissionsAsync, requestPermissionsAsync } = mediaLibrary();
  const current = await getPermissionsAsync(true);
  if (current.granted) return "granted";
  if (current.status === "denied" && !current.canAskAgain) return "blocked";
  const res = await requestPermissionsAsync(true);
  if (res.granted) return "granted";
  return res.canAskAgain ? "denied" : "blocked";
}

/** Downloads a clip to the phone's photo library (Photos / Gallery). Native only. */
export async function saveClipToPhotos(uri: string | null): Promise<ExportResult> {
  if (Platform.OS === "web" || !uri) return "unavailable";
  const access = await ensurePhotosWriteAccess();
  if (access === "blocked") {
    Alert.alert(
      "Photos access is off",
      "Allow “Add to Photos” for Dash Cam in Settings so clips can be downloaded to your library.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ],
    );
    return "blocked";
  }
  if (access === "denied") return "denied";
  try {
    await mediaLibrary().Asset.create(uri);
    return "saved";
  } catch (e) {
    console.warn("[export] save failed", e);
    return "error";
  }
}

/** Opens the system share sheet (AirDrop, Files, Messages, Drive…) for the clip. */
export async function shareClip(uri: string | null): Promise<ExportResult> {
  if (Platform.OS === "web" || !uri) return "unavailable";
  try {
    if (!(await Sharing.isAvailableAsync())) return "unavailable";
    await Sharing.shareAsync(uri, { mimeType: "video/mp4", UTI: "public.mpeg-4", dialogTitle: "Share dash cam clip" });
    return "shared";
  } catch (e) {
    console.warn("[export] share failed", e);
    return "error";
  }
}

export function exportMessage(result: ExportResult): string | null {
  switch (result) {
    case "saved":
      return "Saved to Photos";
    case "denied":
      return "Photos permission needed to download";
    case "unavailable":
      return "Download is available on the mobile app";
    case "error":
      return "Couldn't export this clip";
    default:
      return null;
  }
}
