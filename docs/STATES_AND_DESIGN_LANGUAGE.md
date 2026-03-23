# States & Design Language

> **Purpose**: This document establishes a shared vocabulary for describing Photo Signal's states,
> events, and UI across all design conversations, tickets, and agent requests. Use the names here
> when discussing or specifying changes.

---

## Overview

Photo Signal is a camera-based music experience. The user points a device at a printed photograph;
the app recognises it via pHash, displays concert metadata, and begins playing the matching artist's
songs. The experience is layered: the **App Lifecycle** controls whether the camera is running at
all; the **Recognition Pipeline** drives the moment of discovery; **Audio Playback** carries the
experience after a match; and a set of named **UI Panels** appear and disappear in response to all
three.

---

## 1. App Lifecycle States

The top-level mode the application is in. Only one can be active at a time.

| State      | Trigger In                                        | Trigger Out                            | Description                                                               |
| ---------- | ------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `LOCKED`   | App loads; access gate enabled + no valid session | User enters correct passcode           | Passcode entry screen. Nothing else is visible.                           |
| `LANDING`  | App loads (no gate); or `SHUTDOWN` completes      | `TUNE_IN`                              | "Still Broadcasting" headline. Camera off.                                |
| `ACTIVE`   | `TUNE_IN`                                         | `PAGE_HIDDEN` → `SHUTDOWN`             | Camera on; recognition running; experience live.                          |
| `SHUTDOWN` | Tab hidden, page unloads, or app backgrounded     | (Immediately transitions to `LANDING`) | Teardown: audio stopped, timers cleared, camera stopped, all state reset. |

---

## 2. Camera States

Camera permission and stream state within `ACTIVE`.

| State        | Description                                                           |
| ------------ | --------------------------------------------------------------------- |
| `REQUESTING` | Browser permission prompt is in flight. UI shows "Summoning camera…"  |
| `GRANTED`    | Stream acquired; video tracks running. Recognition may begin.         |
| `DENIED`     | User or OS blocked camera. UI shows error + "Let me in" retry button. |
| `STOPPED`    | Tracks halted (follows `SHUTDOWN`). No stream exists.                 |

---

## 3. Recognition States

The photo-recognition pipeline state. Operates only while the app is `ACTIVE` and camera is `GRANTED`.

| State       | Check Interval | Description                                                                               |
| ----------- | -------------- | ----------------------------------------------------------------------------------------- |
| `IDLE`      | 120 ms         | No candidate in view. Scanning continuously.                                              |
| `CHECKING`  | —              | Frame captured; pHash computed; quality gates evaluated; best match sought.               |
| `CANDIDATE` | 80 ms          | A potential match found. Monitoring to confirm it holds for `recognitionDelay` (150 ms).  |
| `MATCHED`   | —              | Concert confirmed. Recognition paused. Concert info and audio begin.                      |
| `COOLDOWN`  | —              | Dismiss just happened. Same concert locked out for 2 000 ms. Other photos still eligible. |
| `PAUSED`    | —              | Recognition explicitly suspended. Happens while `SecretSettings` is open.                 |

### Frame Quality Sub-statuses

These are per-frame evaluations that determine whether a frame is usable for matching. They are not
persistent states — they apply to individual frames and are surfaced in the `DebugOverlay`.

| Sub-status     | Condition                                                    |
| -------------- | ------------------------------------------------------------ |
| `PASS`         | Frame meets all quality gates; proceeds to matching.         |
| `BLURRED`      | Laplacian variance < 85. Frame is too soft to hash reliably. |
| `GLARE`        | > 20% of frame pixels are above brightness 250.              |
| `UNDEREXPOSED` | Mean brightness < 50.                                        |
| `OVEREXPOSED`  | Mean brightness > 220.                                       |

### Match Quality Levels

When a frame passes quality gates, its best match is assessed by Hamming distance.

| Level         | Distance  | Behaviour                                                                      |
| ------------- | --------- | ------------------------------------------------------------------------------ |
| No match      | > 14 bits | Logged as near-miss if close. Scanning continues.                              |
| Candidate     | ≤ 14 bits | Starts / resets `CANDIDATE` tracking timer.                                    |
| Instant match | ≤ 10 bits | Recognition delay skipped; confirms in a single frame (if margin also passes). |
| Margin fail   | Any       | Best–second-best gap < 4 bits → ambiguous; rejected even if distance passes.   |

---

## 4. Audio Playback States

| State     | Description                                                                             |
| --------- | --------------------------------------------------------------------------------------- |
| `IDLE`    | No audio loaded. Signal strip hidden.                                                   |
| `LOADING` | Howl instance created; audio resource fetching. Cannot play yet.                        |
| `PLAYING` | Audio producing output. Progress (0–1) updates every frame.                             |
| `PAUSED`  | Suspended by user. Position preserved; resume continues from same point.                |
| `FADING`  | Fade-out in progress (1 000 ms default) before a crossfade.                             |
| `ENDED`   | Track completed naturally. Triggers `SONG_ENDED` → auto-advance.                        |
| `ERROR`   | Load/decode failure or browser autoplay block. Error message displayed in signal strip. |

### Audio Error Sub-types

| Sub-type             | Message Shown                                                                  |
| -------------------- | ------------------------------------------------------------------------------ |
| Autoplay blocked     | "Playback blocked by browser autoplay rules. Touch screen and tap Play again." |
| Load / decode failed | "Audio failed to start. Tap Play to retry."                                    |

---

## 5. UI Panels

Named panels and their visibility conditions. Panels stack on top of the camera feed.

| Panel                     | Visible When                               | Hidden When                                           |
| ------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| `AccessGate`              | App lifecycle is `LOCKED`                  | Passcode accepted                                     |
| `LandingScreen`           | App lifecycle is `LANDING`                 | `TUNE_IN`                                             |
| `CameraFeed`              | `ACTIVE` + recognition not `MATCHED`       | Concert info visible                                  |
| `ConcertInfoOverlay`      | Recognition is `MATCHED`                   | `CLOSE_CONCERT_INFO`                                  |
| `ScannedPhoto`            | `MATCHED` + `concert.photoUrl` loaded      | `CLOSE_CONCERT_INFO`                                  |
| `ScannedPhotoPlaceholder` | `MATCHED` + no valid `photoUrl`            | `CLOSE_CONCERT_INFO`                                  |
| `ZoomDialog`              | `TAP_PHOTO`                                | User dismisses (tap backdrop / close button / Escape) |
| `DownloadPrompt`          | `LONG_PRESS_PHOTO` (500 ms)                | User cancels or confirms download                     |
| `SignalStrip`             | `activeConcert` is set                     | `activeConcert` cleared (shutdown)                    |
| `DebugOverlay`            | Feature flag `show-debug-overlay` = `true` | Flag off, or `SecretSettings` open                    |
| `SecretSettings`          | `OPEN_SETTINGS`                            | `CLOSE_SETTINGS`                                      |

---

## 6. Triggers & Events

All named events that drive state transitions. Use these names in tickets and design specs.

### User-Initiated

| Event                | Source                              | Effect                                                         |
| -------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `TUNE_IN`            | Tap "Tune in" on `LandingScreen`    | App → `ACTIVE`; camera starts                                  |
| `CLOSE_CONCERT_INFO` | Tap "↩ scan another"                | Hides `ConcertInfoOverlay`; starts `COOLDOWN` for that concert |
| `TAP_PHOTO`          | Tap `ScannedPhoto`                  | Opens `ZoomDialog`                                             |
| `LONG_PRESS_PHOTO`   | 500 ms press on `ScannedPhoto`      | Opens `DownloadPrompt`                                         |
| `TOGGLE_PLAYBACK`    | Tap play/pause in `SignalStrip`     | Toggles `PLAYING` ↔ `PAUSED`; sets user-paused flag            |
| `NEXT_TRACK`         | Tap next in `SignalStrip`           | Advances playlist; crossfades if currently `PLAYING`           |
| `PREV_TRACK`         | Tap prev in `SignalStrip`           | Retreats playlist; crossfades if currently `PLAYING`           |
| `VOLUME_CHANGE`      | Drag volume slider in `SignalStrip` | Updates Howler volume                                          |
| `OPEN_SETTINGS`      | Tap settings icon                   | Opens `SecretSettings`; pauses recognition                     |
| `CLOSE_SETTINGS`     | Tap close in `SecretSettings`       | Closes `SecretSettings`; resumes recognition                   |
| `FORCE_MATCH`        | Button in `SecretSettings`          | Debug only. Forces a concert match without camera.             |

### System / Pipeline

| Event                | Source                                           | Effect                                                                         |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `FRAME_CAPTURED`     | Recognition interval fires                       | Begins `CHECKING` cycle                                                        |
| `QUALITY_REJECTED`   | Frame fails quality gate                         | Frame discarded; sub-status logged; recognition stays in `IDLE` or `CANDIDATE` |
| `CANDIDATE_DETECTED` | Frame passes threshold; first match              | Recognition → `CANDIDATE`; 80 ms interval begins                               |
| `MATCH_CONFIRMED`    | Candidate held for `recognitionDelay` (150 ms)   | Recognition → `MATCHED`; concert info and audio triggered                      |
| `INSTANT_MATCH`      | Distance ≤ 10 bits                               | Skips delay; immediately → `MATCHED`                                           |
| `MATCH_LOST`         | Best match changes while in `CANDIDATE`          | Tracking timer reset; new candidate begins                                     |
| `COOLDOWN_EXPIRED`   | 2 000 ms after `CLOSE_CONCERT_INFO`              | That concert becomes eligible again                                            |
| `SONG_ENDED`         | Howler `end` event                               | If not user-paused: auto-advance to next track                                 |
| `NEW_ARTIST_SCANNED` | `MATCHED` band ≠ active playlist band            | New shuffled playlist built for new artist; playback switches                  |
| `PAGE_HIDDEN`        | `visibilitychange` / `pagehide` / `beforeunload` | → `SHUTDOWN`                                                                   |

---

## 7. Concert Info Screen Fields

Fields rendered in `ConcertInfoOverlay` and `SignalStrip` when a match is confirmed.

| Field         | Source Property         | Where Shown                                  | Notes                                   |
| ------------- | ----------------------- | -------------------------------------------- | --------------------------------------- |
| Band name     | `concert.band`          | `ConcertInfoOverlay` (large) + `SignalStrip` | CRT phosphor glow applied               |
| Venue         | `concert.venue`         | `ConcertInfoOverlay` meta line               |                                         |
| Date          | `concert.date`          | `ConcertInfoOverlay` meta line               | ISO 8601; formatted to "Month DD, YYYY" |
| Aperture      | `concert.aperture`      | `ConcertInfoOverlay` EXIF row                | Only shown if present (e.g. `f/2.8`)    |
| Shutter speed | `concert.shutterSpeed`  | `ConcertInfoOverlay` EXIF row                | Only shown if present (e.g. `1/250s`)   |
| ISO           | `concert.iso`           | `ConcertInfoOverlay` EXIF row                | Only shown if present (e.g. `ISO 3200`) |
| Focal length  | `concert.focalLength`   | `ConcertInfoOverlay` EXIF row                | Only shown if present (e.g. `18.3mm`)   |
| Song title    | `concert.songTitle`     | `SignalStrip`                                |                                         |
| Scanned photo | `concert.photoUrl`      | `ScannedPhoto` panel                         | R2 CDN URL; full-quality print scan     |
| Album cover   | `concert.albumCoverUrl` | `SignalStrip`                                | R2 CDN; ~200×200 WebP                   |

---

## 8. Feature Flags

Controlled via `SecretSettings` menu. Persisted in localStorage as `photo-signal-feature-flags`.

| ID                      | Label                        | Category     | Default | Effect                                                                                                   |
| ----------------------- | ---------------------------- | ------------ | ------- | -------------------------------------------------------------------------------------------------------- |
| `exif-visual-character` | EXIF Visual Character        | ui           | `true`  | ISO drives grain intensity; aperture drives backdrop blur; shutter speed drives reveal animation speed   |
| `rectangle-detection`   | Dynamic Rectangle Detection  | experimental | `true`  | Detects photo boundary in frame; crops to detected edges; shows framing overlay                          |
| `show-debug-overlay`    | Debug Overlay                | development  | `false` | Shows `DebugOverlay` panel with live recognition telemetry                                               |
| `audio-reactive-glow`   | Audio-Reactive Phosphor Glow | audio        | `true`  | Band name text shadow pulses with bass frequency via Web Audio `AnalyserNode` when `MATCHED` + `PLAYING` |

---

## 9. Recognition Tuning Parameters

Reference values for discussing recognition sensitivity and performance.

| Parameter               | Default                 | What It Controls                                                            |
| ----------------------- | ----------------------- | --------------------------------------------------------------------------- |
| Similarity threshold    | 14 Hamming bits         | Maximum distance to count as a match (≤ 14 ≈ ≥ 78% similar)                 |
| Recognition delay       | 150 ms                  | How long a candidate must remain the best match before confirming           |
| Instant match threshold | 10 bits                 | Distance at or below which the delay is skipped (≈ 84% similar)             |
| Match margin            | 4 bits                  | Minimum gap between best and second-best match; prevents ambiguous confirms |
| Idle check interval     | 120 ms                  | Frame capture rate when no candidate is being tracked                       |
| Tracking check interval | 80 ms                   | Frame capture rate while a candidate is being tracked                       |
| Sharpness threshold     | 85 (Laplacian variance) | Minimum frame sharpness; below this → `BLURRED`                             |
| Glare threshold         | 20% of frame            | Maximum proportion of glare pixels before → `GLARE` rejection               |
| Exposure range          | 50–220 (0–255 scale)    | Valid brightness window; outside → `UNDEREXPOSED` or `OVEREXPOSED`          |
| Cooldown duration       | 2 000 ms                | Lock-out period for a dismissed concert                                     |
