import { Platform } from "react-native";

// Local persistent storage for recorded segments. Never runs on web.
const CLIPS_DIR_NAME = "clips";

type FS = typeof import("expo-file-system");
let fsModule: FS | null = null;
function fs(): FS | null {
  if (Platform.OS === "web") return null;
  if (!fsModule) fsModule = require("expo-file-system") as FS;
  return fsModule;
}

function clipsDir() {
  const m = fs();
  if (!m) return null;
  const dir = new m.Directory(m.Paths.document, CLIPS_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Moves a freshly recorded temp file into the app's clips folder. Returns final uri + size. */
export async function persistRecording(tempUri: string, clipId: string) {
  const m = fs();
  const dir = clipsDir();
  if (!m || !dir) return { uri: tempUri, sizeBytes: 0 };
  const source = new m.File(tempUri);
  const ext = tempUri.split(".").pop()?.split("?")[0] || "mp4";
  const dest = new m.File(dir, `${clipId}.${ext}`);
  try {
    await source.move(dest);
    return { uri: dest.uri, sizeBytes: dest.size ?? 0 };
  } catch (e) {
    console.warn("[files] move failed, keeping temp uri", e);
    return { uri: tempUri, sizeBytes: source.exists ? (source.size ?? 0) : 0 };
  }
}

export function deleteClipFile(uri: string | null) {
  const m = fs();
  if (!m || !uri) return;
  try {
    const f = new m.File(uri);
    if (f.exists) f.delete();
  } catch (e) {
    console.warn("[files] delete failed", e);
  }
}

export function getDiskInfo() {
  const m = fs();
  if (!m) return { total: 0, available: 0 };
  try {
    return { total: m.Paths.totalDiskSpace, available: m.Paths.availableDiskSpace };
  } catch {
    return { total: 0, available: 0 };
  }
}
