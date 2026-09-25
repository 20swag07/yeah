# Dash Cam — PRD & Progress

## Original problem statement
Mobile dash cam app (Expo + FastAPI + MongoDB) with a modern, slim, flat Revolut-style UI (light + dark).
- Continuous recording while app is open; front + back cameras (dual is native-only).
- Save recordings locally on the phone.
- Accelerometer impact detection → save current clip immediately, local notification + Emergent push.
- GPS speed HUD with km/h ⇄ mph toggle in settings (and on the HUD).
- Trip/event history: saved clips with impact flag, speed, timestamps.
- User: no realistic photos — abstract/geometric modern UI only.

## Architecture
- `frontend/app/_layout.tsx` — fonts (Geist + SpaceMono), theme sync, notification handler/channel, tap handlers, denied nudge, silent push re-registration.
- `frontend/app/(tabs)/` — `index.tsx` (Record), `history.tsx`, `settings.tsx`; `app/clip/[id].tsx` — clip detail + expo-video playback.
- `frontend/src/hooks/` — `useRecorder` (segment loop via expo-camera `recordAsync(maxDuration)`, impact-flagged save, storage cleanup), `useSpeed` (expo-location), `useImpactDetection` (expo-sensors Accelerometer, sensitivity thresholds).
- `frontend/src/store/` — zustand persisted `settings` (unit, theme, sensitivity, clip length, notifications, autoStart, deviceId) and `clips` (local metadata).
- `frontend/src/services/` — `api.ts` (backend), `files.ts` (expo-file-system clips dir), `notifications.ts` (local + Emergent push registration).
- `frontend/src/theme.ts` — light/dark tokens from design_guidelines.json + `feed*` tokens for camera chrome.
- `backend/server.py` — `/api/register-push`, `/api/events` (POST triggers `send_push` on impact), `GET/DELETE /api/events`.

## Data model (Mongo `events`)
`{id, device_id, clip_id, type: impact|trip, recorded_at, duration_sec, max_speed_kmh, avg_speed_kmh, g_force?, latitude?, longitude?, has_video, created_at}`

## Status
- [x] Design guidelines fetched, theme implemented (light + dark, in-app toggle)
- [x] Record screen: camera feed, REC pill, speed HUD + unit toggle, controls (pause/start, save clip, mark event), G-meter, impact banner, permission gates (camera/mic/location/notifications per contract), web preview mode
- [x] Dual camera: user chose one-tap front/back switch (flip button); PiP/second CameraView removed because iOS cannot run two capture sessions (CameraRecordingFailedException). Native multi-cam module deferred/declined.
- [x] Impact detection + local notification + backend event → Emergent push
- [x] History (day sections, All/Impacts filter, empty state), clip detail (video playback, facts, lock, delete)
- [x] Settings (units, theme, clip length, autostart, dual cam, sensitivity, alerts, storage, delete all)
- [x] app.json permissions + plugins (camera, location, sensors, notifications, video)
- [ ] User must supply `frontend/google-services.json` for Android push (referenced in app.json)
- [x] Testing agent run (iteration_1): backend 7/7, frontend all flows pass; dark-mode-on-web bug fixed (useTheme reads settings.theme)

## Notes / limitations
- Video capture, accelerometer, push: need real device (Expo Go for camera/sensors; push needs a Publish build).
- Web preview: HUD/flows run in "preview mode" — events saved without video.
- Simultaneous dual recording is not possible with expo-camera; would need a custom AVCaptureMultiCamSession module + published build (user declined for now).
- Fixes (iteration 2): permission card was covered by bottom HUD (hidden while gate is up), speed digits clipped (lineHeight), record button dead after flip (CameraView keyed by facing, recorder waits for camera-ready, awaitable stop, retry loop with generation tokens).
