# Environmental Effects & Controlled Randomness — Ideas

> **Status**: Brainstorm / backlog. These are candidate features, not implementation specs.
> Implementation plans for the first two features (EXIF-driven visual character and audio-reactive
> phosphor glow) live in the project plan files.

The goal of this document is to capture creative ways the UI experience can be shaped by environmental
variables and controlled randomness. Every idea here should feel like it was always supposed to be
part of the experience — not a novelty, but a quiet deepening.

**Design constraints that apply to all ideas:**

- All transitions must be smooth and intentional — CSS handles color/opacity blending; state changes
  happen at event boundaries (match, unmatch, app open, phone unlock), not continuously
- All randomness requires guardrails: min/max clamps, per-session seeding, never per-frame chaos
- The dead signal → matched state narrative is sacred — no effect should fight it
- Recognition pipeline runs in a Web Worker — never add load to the main thread recognition path
- Every implemented effect needs a feature flag in `src/modules/secret-settings/config.ts`

---

## Available Environmental Data

### Always available (no permissions)

- Current time and date (user's local timezone)
- Concert `date` field: full ISO 8601 timestamp including time-of-day (when the photo was taken),
  always America/Chicago. All 152 concerts are SXSW, mid-March, 2022–2025.
- Concert EXIF: `iso`, `aperture`, `shutterSpeed`, `camera` per concert
- Concert `band`, `venue`, `date` (year, day-of-week already drives palette hue)
- Session state: time since app open, time since last match, match count (track in refs)
- Audio: `progress` (0–1), `isPlaying` from `useAudioPlayback`
- Audio frequency: `Howler.ctx` exposes the Web Audio context for `AnalyserNode` taps
- Motion state: existing `useMotionDetection` hook

### Requires browser permission

- Device orientation: `DeviceOrientationEvent` (no permission on most browsers; iOS 13+ needs one tap)
- Geolocation: explicit permission, high user friction
- Battery: `navigator.getBattery()` (deprecated in some browsers)
- Network quality: `navigator.connection?.effectiveType` (no permission, but limited browser support)

---

## Ideas by Category

### Time & Date

**SXSW ghost season**
All concerts are mid-March. During the ~10-day SXSW window each year (roughly March 10–20), the app
enters a heightened ambient state. The dead-signal searching animation is faster and brighter — like
the air is electric. Scan lines pulse at a slightly higher frequency. When you match a photo, the
year appears briefly as a ghost overlay ("'25", "'24") before fading. You are looking at a signal
that is seasonally resonant with right now.

**Exact anniversary resonance**
When you match a photo and today's calendar date (month + day) is the same as the concert date —
within a ±1 day window — a unique event fires: a brief chromatic aberration flash that doesn't happen
any other time, followed by a small "N years ago" ephemeral text that fades over 2s. Intentionally
rare (a few days per year per photo). The rarity is the feature.

**Time-of-day echo**
Each concert has a real photo-taking timestamp (10am–7pm range). If you're using the app within ±1
hour of the time-of-day the original photo was taken, a "temporal overlap" state fires while the
match is active. Expressed as: the concert info text briefly pulses brighter before settling, and
the EXIF time-of-capture glows faintly in the metadata row. Feels like déjà vu.

**Concert age patina**
The year of the concert determines how "worn" the matched overlay looks. 2022: slight grain increase
(+0.04 opacity), slight desaturation of poster palette (−8%). 2025: clean and bright. 2023/2024 in
between. The past physically looks older. The four-year range is small enough that this is subtle —
a mood, not a mode.

**Day-of-week echo (expanded)**
The day-of-week already seeds the palette hue. Go further: if today is the same day of the week as
when the original photo was taken (both Thursdays, both Fridays, etc.), the palette resonates more
strongly — lightness slightly boosted. "In phase." Turns a static derivation into a live comparison.

---

### Session & Usage

**Time since last match — idle restlessness**
Track `lastMatchTimestamp` in a ref. After 45 seconds with no match, scan line opacity gradually
increases (max +0.3 opacity over the next 60s). The signal is hunting. On next match, snaps back
instantly. Pairs with the existing `chromaticShift` animation.

**Session warmup ("cold tube")**
First 2 minutes after opening the app, the phosphor glow is slightly cooler/dimmer — like a CRT tube
warming from cold. Linear interpolation over 2 minutes. Persists in `sessionStorage` so page
navigations don't restart the warmup. CSS transitions handle all blending.

**First match of session — grander reveal**
The very first photo match of a session gets a 1.5× longer `posterReveal` animation and an extra
chromatic aberration beat. Every subsequent match: normal timing. The first match feels like the
gallery opening for you.

**Session depth ("worn-in")**
After 5+ matches in a single session, the grain overlay opacity increases by +0.03 and stays for the
session. A second threshold at 10+ matches adds another +0.03. Max +0.06. Like a ticket stub getting
stamped. Resets on page close.

---

### Audio & Song State

**Audio-reactive phosphor glow** ← _Plan 2 (first implementation)_
Tap `Howler.ctx` for an `AnalyserNode`. Extract bass band energy (~60–200Hz). Modulate
`--glow-reactive-scale` CSS variable, which all `text-shadow` glow px values multiply via `calc()`.
Range: 0.85–1.20. `smoothingTimeConstant = 0.85` (lazy, not twitchy). Only active during matched
state. The signal breathes with the song.

**Song-progress scan line fade**
As a song plays toward its end (progress 0→1), scan line opacity gradually increases (max +0.12 at
100% complete). Brief reset on song transition. The broadcast fades as the song ends — the visual
reinforces the audio's arc.

**Song position overlay drift**
Concert info text drifts very subtly (max ±3px Y, sine wave) based on song position, not wall-clock
time. Max amplitude at the midpoint. Like the signal is slightly delayed. Only active
during matched + playing state.

---

### Photo Metadata (EXIF) Driven

**ISO → grain intensity** ← _Part of Plan 1 (first implementation)_
`concert.iso` maps to grain texture overlay opacity. ISO 100 → 0.02 opacity, ISO 3200+ → 0.12.
The photo's shooting conditions bleed into its display.

**Aperture → background blur depth** ← _Part of Plan 1 (first implementation)_
`concert.aperture` (f-number) maps to `backdrop-filter: blur()` on the concert info overlay
background. f/1.8 → 14px blur (shallow depth of field). f/8 → 2px blur. The optics of the original
shot echo in the UI.

**Shutter speed → match transition timing** ← _Part of Plan 1 (first implementation)_
`concert.shutterSpeed` informs the `posterReveal` animation duration. 1/30s slow shutter → slower
luxurious reveal (1.3×). 1/500s fast → snappy (0.7×). Clamped to 0.6–1.4×.

**Camera model → era micro-bias**
Parse `concert.camera` for known models. A film-era DSLR → warm amber bias (+5° hue offset). A
modern iPhone → neutral/clean. Lookup table or simple string heuristic. Very subtle.

**Concert age × EXIF grain compounding**
Combine age patina and ISO grain: `totalGrainOpacity = ageGrain + isoGrain`. Hard-clamped at 0.15
max. The oldest photos at the highest ISOs look the most authentically worn.

---

### Device Sensors

**Device tilt → poster perspective**
`DeviceOrientationEvent`. Apply CSS `perspective + rotateX/rotateY` (max ±4°) to the concert info
overlay based on phone tilt. Holding the phone slightly sideways tilts the virtual "poster."
Spring-physics smoothing, hard clamp. No permission needed on most browsers.

**Signal shake on camera motion**
Existing `useMotionDetection` hook already detects camera movement. During high-motion periods, apply
brief `translate` jitter to the CRT scan line layer (max ±2px, 3 frames). The signal shakes when
you shake.

**Battery → conservation mode**
`navigator.getBattery()`. Below 20%, reduce glow brightness (multiply `--signal-glow` amplitude by
0.65) and slow pulse animations. Aesthetic but also genuinely functional.

**Network quality → signal noise**
`navigator.connection?.effectiveType`. Slow connections raise scan line visibility and add noise.
Fast connections: clean signal. The transmission medium matches its quality.

---

### Controlled Randomness

**Per-session CRT phosphor seed**
On app open, pick a random float (0–1) to slightly bias the phosphor color temperature for this
session. Slightly greenish (P1 phosphor), slightly cool (P31), or canonical warm amber. ±8° hue on
scan line color and main text. Constant for the session — different every time you open the app.

**Stochastic CRT glitch frames**
~0.3% probability per second (roughly once every 5 minutes): a single-frame CRT glitch fires —
`chromaticShift` animation spike + scan line skip. The keyframe animation already exists. Just needs
a Poisson-style timer. Can be disabled in secret settings.

**Signal drift during search**
While in no-match state, the background CRT glow very slowly drifts through a ±4° hue random walk
(new target every 8–12s, CSS transition handles smooth interpolation). When a match locks, it snaps
to the deterministic palette. The signal was wandering; now it's found.

**Match confirmation timing jitter**
The `posterReveal` animation plays with a random ±80ms delay each time. Never exactly the same.
Like a real signal locking — not a scripted animation.

**Album cover dominant color micro-bleed**
When album cover loads, canvas-sample its dominant color. Add a very small additive hue modifier to
the poster palette (±5° hue, ±4% saturation). Hard-clamped. The album art very subtly bleeds into
how the poster feels.

---

## Planned Feature Flags

These IDs and categories are intended for `src/modules/secret-settings/config.ts` as effects are
implemented. All effects should default to enabled unless experimental or sensor-dependent.

| Category       | Flag ID                   | Default |
| -------------- | ------------------------- | ------- |
| `ui`           | `exif-visual-character`   | `true`  |
| `ui`           | `concert-age-patina`      | `true`  |
| `ui`           | `sxsw-ghost-season`       | `true`  |
| `ui`           | `anniversary-resonance`   | `true`  |
| `ui`           | `temporal-echo`           | `true`  |
| `ui`           | `session-warmup`          | `true`  |
| `ui`           | `idle-restlessness`       | `true`  |
| `audio`        | `audio-reactive-glow`     | `true`  |
| `audio`        | `song-progress-scanlines` | `true`  |
| `experimental` | `device-tilt-perspective` | `false` |
| `experimental` | `stochastic-glitch`       | `true`  |
| `experimental` | `per-session-phosphor`    | `true`  |

The secret-settings UI should eventually group flags visually by category with section headers.
The `FeatureFlag.category` type in `src/modules/secret-settings/types.ts` already supports this.
