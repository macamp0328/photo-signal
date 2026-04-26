# Design System

> **Purpose**: This document is the canonical reference for Photo Signal's visual design tokens,
> color system, typography, animation vocabulary, visual effects, and responsive constraints. Use the
> names and values here when discussing or specifying visual changes — they are the shared language
> for all design work.

> **See also**: `docs/STATES_AND_DESIGN_LANGUAGE.md` — canonical vocabulary for app lifecycle,
> recognition, audio, and camera states that drive the visual transitions defined here.

---

## 1. Design Philosophy

Photo Signal's visual identity is **era-matched gig poster / zine aesthetic** — a physical artifact
from the punk/indie concert era, not a generic mobile app. The experience is built around a single
narrative: **dead signal → matched**. Before a match, the UI is a warm amber broadcast on near-black,
complete with CRT scan lines, phosphor glow, and signal stutter. At the moment of match, the palette
switches to a per-concert color derived from the band and the day they played, scan lines fade out,
and the concert info reveals like a poster being illuminated.

This identity is **load-bearing**. CRT scan lines, phosphor glow, chromatic aberration, and the
matched-state palette transition are intentional design choices, not candidates for simplification.
Environmental signals (time, EXIF, audio) are used to make the experience feel alive and
non-repeating without ever fighting the dead-signal → matched narrative.

---

## 2. Color System

There are two palettes: the **Dead Signal Palette** (static amber broadcast) that is always active,
and the **Concert Palette** (dynamic per-match) that overrides it when a photo is recognized.

### Dead Signal Palette

Warm amber on near-black. All values are set in `:root` and active until a match occurs.

| Token                          | Value                     | Role                         |
| ------------------------------ | ------------------------- | ---------------------------- |
| `--color-background`           | `#0a0800`                 | Main background (near-black) |
| `--color-sub-background`       | `#130900`                 | Secondary background         |
| `--color-main-text`            | `#d4892a`                 | Primary text / accent        |
| `--color-sub-text`             | `#b87020`                 | Secondary text               |
| `--color-bonus-text`           | `#7a4a14`                 | Tertiary / muted text        |
| `--color-text`                 | `#d4892a`                 | General text alias           |
| `--color-accent`               | `#d4892a`                 | Primary interactive accent   |
| `--color-accent-light`         | `#e8a040`                 | Lighter accent variant       |
| `--color-accent-hover`         | `#e09030`                 | Hover state                  |
| `--color-text-muted`           | `#6a3e10`                 | Disabled / placeholder text  |
| `--color-button-bg`            | `#d4892a`                 | Button fill                  |
| `--color-button-text`          | `#0a0800`                 | Button label                 |
| `--color-button-hover-bg`      | `#e8a040`                 | Button fill on hover         |
| `--color-button-hover-text`    | `#0a0800`                 | Button label on hover        |
| `--color-button-disabled-bg`   | `#1c0f00`                 | Disabled button fill         |
| `--color-button-disabled-text` | `#4a2e08`                 | Disabled button label        |
| `--overlay-bg`                 | `rgba(10, 8, 0, 0.9)`     | Modal / overlay backdrop     |
| `--modal-bg`                   | `#130900`                 | Modal content background     |
| `--modal-border`               | `rgba(212, 137, 42, 0.2)` | Modal / card border          |

### Semantic Colors

| Token              | Value     | Role               |
| ------------------ | --------- | ------------------ |
| `--color-error`    | `#ef4444` | Error state        |
| `--color-success`  | `#22c55e` | Success state      |
| `--color-warning`  | `#fbbf24` | Warning state      |
| `--color-gray-200` | `#e5e7eb` | Light utility gray |
| `--color-gray-400` | `#9ca3af` | Mid utility gray   |

### Concert Palette

At match time, `applyConcertPalette()` in `src/utils/concert-palette.ts` generates three
concert-specific values and writes them to `<html>` as CSS custom properties. The
`html[data-state="matched"]` block in `src/index.css` then re-maps all color tokens to these values
via `color-mix()`.

| Token              | Description                    |
| ------------------ | ------------------------------ |
| `--poster-bg`      | Concert-specific background    |
| `--poster-primary` | Concert-specific primary color |
| `--poster-accent`  | Concert-specific accent color  |

**Algorithm** (FNV-1a hash + day-of-week anchoring):

1. FNV-1a 32-bit hash of the normalized band name
2. Day-of-week anchors the primary hue: each day owns ~51° of the 360° hue wheel
   (Sun: 0°, Mon: 51°, Tue: 103°, Wed: 154°, Thu: 205°, Fri: 257°, Sat: 308°)
3. `primaryHue = dayBase + (hash % 51)` — band name shifts within the day's arc
4. `accentHue = primaryHue + 137°` — golden angle, maximizes contrast
5. `bgHue = primaryHue + 20°` — subtle shift; rendered at 5% lightness
6. Lightness: 62–72%, driven by upper hash bits for character

Generated output:

| Property  | HSL formula                     |
| --------- | ------------------------------- |
| `bg`      | `hsl(bgHue, 75%, 5%)`           |
| `primary` | `hsl(primaryHue, 100%, 62–72%)` |
| `accent`  | `hsl(accentHue, 100%, 58%)`     |

The result is **deterministic** — same band on same day always produces identical colors.

---

## 3. CSS Custom Properties Reference

### Glow & Signal Variables

| Token                | Default Value              | Role                                         |
| -------------------- | -------------------------- | -------------------------------------------- |
| `--signal-glow`      | `rgba(212, 137, 42, 0.34)` | Primary glow (text-shadow, box-shadow)       |
| `--signal-glow-soft` | `rgba(212, 137, 42, 0.14)` | Ambient / soft glow                          |
| `--crt-opacity`      | `1`                        | CRT scan line layer opacity (0 when matched) |
| `--crt-glow-color`   | `rgba(212, 137, 42, 0.28)` | CRT phosphor glow color                      |

### Background & Texture Variables

| Token                     | Dead Signal Value                | Role                               |
| ------------------------- | -------------------------------- | ---------------------------------- |
| `--bg-gradient-top`       | `rgba(212, 137, 42, 0.16)`       | Top radial gradient color          |
| `--bg-gradient-top-clear` | `rgba(212, 137, 42, 0)`          | Gradient fade-out color            |
| `--bg-gradient-bottom`    | `transparent`                    | Bottom radial gradient color       |
| `--texture-image`         | `url('/backgrounds/gravel.svg')` | Background SVG texture             |
| `--texture-opacity`       | `0.1`                            | Texture blend opacity              |
| `--texture-blend-mode`    | `overlay`                        | How texture blends with background |

### EXIF Visual Character Variables

Set by `src/utils/exif-visual.ts` at match time, based on the concert's shooting conditions.

| Token                     | Default | Range       | Driven By                                   |
| ------------------------- | ------- | ----------- | ------------------------------------------- |
| `--exif-grain-opacity`    | `0.04`  | `0.06–0.28` | ISO: higher ISO → more grain                |
| `--exif-transition-scale` | `1`     | `0.6–1.4`   | Shutter speed: slow shutter → slower reveal |

### Layout & Shape Tokens

| Token             | Value  | Role                            |
| ----------------- | ------ | ------------------------------- |
| `--border-radius` | `8px`  | Default component border radius |
| `--shadow-size`   | `10px` | Default shadow spread size      |

### Focus Indicator Tokens

| Token                 | Value     | Role                |
| --------------------- | --------- | ------------------- |
| `--color-focus`       | `#d4892a` | Focus outline color |
| `--focus-ring-color`  | `#d4892a` | Focus ring color    |
| `--focus-ring-width`  | `2px`     | Focus ring width    |
| `--focus-ring-offset` | `2px`     | Focus ring offset   |
| `--focus-ring-style`  | `solid`   | Focus ring style    |

On matched state, `--focus-ring-color` is overridden to `--poster-accent`.

---

## 4. Typography

### Font Stacks

| Name            | CSS Token                 | Stack                                                                                         | Used For                         |
| --------------- | ------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------- |
| **Mono / UI**   | `--font-family`           | `ui-monospace, 'SF Mono', SFMono-Regular, Menlo, 'Cascadia Mono', 'Segoe UI Mono', monospace` | All UI text in dead signal state |
| **Display**     | `--font-display`          | `'Bebas Neue', Impact, 'Arial Narrow', sans-serif`                                            | Headlines, band name caption     |
| **System sans** | `--font-family` (matched) | `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif`     | All UI text in matched state     |

`--font-family` is re-mapped to system sans-serif inside `html[data-state='matched']`. Display text
(`--font-display`) is not affected by the state change.

### Type Scale

| Context                         | Font             | Size                           | Line-height | Letter-spacing |
| ------------------------------- | ---------------- | ------------------------------ | ----------- | -------------- |
| Landing headline                | `--font-display` | `clamp(4rem, 14vw, 9rem)`      | `0.92`      | `0.01em`       |
| Band name (above photo)         | `--font-display` | `clamp(1.6rem, 6vw, 2.8rem)`   | `0.92`      | `0.02em`       |
| Band name (above photo, ≤480px) | `--font-display` | `clamp(1.4rem, 5.5vw, 2.4rem)` | `0.92`      | `0.02em`       |
| Meta line (venue, date)         | `--font-family`  | `0.76rem`                      | —           | `0.04em`       |
| Meta line (≤480px)              | `--font-family`  | `0.75rem`                      | —           | `0.04em`       |
| EXIF row                        | `--font-family`  | `0.6rem`                       | —           | `0.06em`       |
| Tagline                         | `--font-family`  | `0.875rem`                     | —           | —              |
| Begin button                    | `--font-family`  | `0.8rem`                       | —           | `0.12em`       |
| Debug overlay                   | `--font-family`  | `0.75rem`                      | —           | —              |

Display text is always `text-transform: uppercase`. Meta / button text uses `text-transform: uppercase`
with wide letter-spacing for legibility.

---

## 5. Spacing System

Six fluid tokens that scale with viewport width via `clamp()`.

| Token           | Min       | Preferred | Max       |
| --------------- | --------- | --------- | --------- |
| `--spacing-xs`  | `0.25rem` | `0.5vw`   | `0.5rem`  |
| `--spacing-sm`  | `0.5rem`  | `1vw`     | `0.75rem` |
| `--spacing-md`  | `0.75rem` | `1.5vw`   | `1rem`    |
| `--spacing-lg`  | `1rem`    | `2vw`     | `1.5rem`  |
| `--spacing-xl`  | `1.5rem`  | `3vw`     | `2rem`    |
| `--spacing-2xl` | `2rem`    | `4vw`     | `3rem`    |

---

## 6. Animation Vocabulary

All named keyframe animations in the system. Duration and easing are per-use-site defaults; individual
components may override.

| Animation               | Duration / Easing                                                       | Defined In                    | Fires When                                                                                               |
| ----------------------- | ----------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `fadeIn`                | Varies (0.5s typical), `ease-out`                                       | `src/index.css`               | Active view enters; general show transitions                                                             |
| `slideUpFade`           | Varies, `ease`                                                          | `src/index.css`               | Elements that slide up into view                                                                         |
| `scaleInFade`           | Varies, `ease`                                                          | `src/index.css`               | Elements that scale in (scale 0.98 → 1)                                                                  |
| `chromaticShift`        | `0.3s`, `ease-in-out`, event-driven                                     | `src/index.css`               | Stochastic glitch timer (~once per 5 min, `useStochasticGlitch`); also planned for anniversary resonance |
| `posterReveal`          | `calc(0.8s × --exif-transition-scale)`, `cubic-bezier(0.16, 1, 0.3, 1)` | `src/index.css`               | Scanned photo frame animates in after `MATCH_CONFIRMED`                                                  |
| `textReveal`            | `0.4–0.5s`, `cubic-bezier(0.16, 1, 0.3, 1)` `both`; staggered delays    | `InfoDisplay.module.css`      | Band name (0.1s), meta (0.22s), EXIF (0.34s) materialize upward in the above-photo caption strip         |
| `signal-flicker`        | `3.2s`, `steps(1)` infinite                                             | `RectangleOverlay.module.css` | Rectangle border while recognition is `CANDIDATE`                                                        |
| `glow-breathe`          | `2.8s`, `ease-in-out` infinite                                          | `RectangleOverlay.module.css` | Glow layer pulses while recognition is `CANDIDATE`                                                       |
| `phosphor-bloom-glow`   | `1.6s`, `cubic-bezier(0.16, 1, 0.3, 1)` `forwards`                      | `RectangleOverlay.module.css` | Glow flares on `MATCH_CONFIRMED`                                                                         |
| `phosphor-bloom-border` | `1.6s`, `cubic-bezier(0.16, 1, 0.3, 1)` `forwards`                      | `RectangleOverlay.module.css` | Border flares amber → near-white → amber on lock                                                         |
| `scan-sweep`            | `2.2s`, `linear` infinite                                               | `RectangleOverlay.module.css` | Horizontal scan line sweeps rectangle interior in `CANDIDATE`                                            |
| `corner-jitter`         | `1.4s`, `steps(3)` infinite                                             | `RectangleOverlay.module.css` | Corner L-brackets jitter digitally in `CANDIDATE`                                                        |
| `corner-stamp`          | `0.45s`, `cubic-bezier(0.34, 1.56, 0.64, 1)` `forwards`                 | `RectangleOverlay.module.css` | Corners spring-stamp into place on `MATCH_CONFIRMED`                                                     |

**Easing conventions**:

- `steps(1)` / `steps(3)` — digital stutter, no interpolation between keyframes
- `cubic-bezier(0.16, 1, 0.3, 1)` — spring-ease (fast out, organic decay)
- `cubic-bezier(0.34, 1.56, 0.64, 1)` — spring with overshoot (stamps past 1.0 before settling)
- Standard `ease` / `ease-out` — UI entrance transitions

---

## 7. Visual Effects

Named effects, their CSS mechanism, and the variable that controls them.

### CRT Scan Lines

- **Mechanism**: `body::after` pseudo-element; `repeating-linear-gradient` of 1px dark lines with 3px transparent gaps (4px total repeat period)
- **Control**: `--crt-opacity` (default `1`, set to `0` in matched state)
- **Transition**: `opacity 1.2s ease` on body::after
- **z-index**: 9998 (above all content)

### Phosphor Glow

- **Mechanism**: Multi-layer `text-shadow` on display text (band name, landing headline)
- **Colors**: `--signal-glow` and `--signal-glow-soft`
- **Intensity**: Static baseline glow tuned directly in component shadow values

### Film Grain Overlay

- **Mechanism**: `body::before` pseudo-element; inline SVG turbulence (`feTurbulence fractalNoise`,
  200×200px tile, `mix-blend-mode: overlay`)
- **Control**: `--exif-grain-opacity` (default `0.04`, range `0.06–0.28`)
- **Activation**: only when `html[data-state='matched'][data-exif-visual]` — requires both a match
  and the EXIF Visual Character feature flag to be enabled

### Chromatic Aberration

- **Mechanism**: `chromaticShift` keyframe animation on a box-shadow with offset red/blue layers
- **Colors**: red fringe `rgba(255, 60, 0, …)`, blue fringe `rgba(0, 100, 255, …)`
- **Activation**: `useStochasticGlitch` hook sets `document.documentElement.style.animation` at ~0.3% probability per second (~once per 5 min); also planned for anniversary resonance (see `docs/ENVIRONMENTAL_EFFECTS_IDEAS.md`)
- **Peak values**: red offset `−3px / +3px`, blue offset `+3px / −3px` at 50% keyframe

### Background Radial Gradients

- **Mechanism**: `body` background composed of two offset `radial-gradient()` layers
  (top-left at 15% / 0%, bottom-right at 85% / 100%) over `--color-background`
- **Colors**: `--bg-gradient-top`, `--bg-gradient-bottom`
- **Dead signal**: subtle amber radial light influence
- **Matched state**: all gradient variables set to `transparent` — pure solid background

### SVG Texture Overlay

- **Mechanism**: `body::before` (overridden by film grain selector when matched + EXIF active)
- **Asset**: `--texture-image: url('/backgrounds/gravel.svg')`
- **Control**: `--texture-opacity` (default `0.1`, set to `0` in matched state),
  `--texture-blend-mode` (default `overlay`, set to `normal` in matched state)

### Rectangle Detection Overlay

- **Detecting state**: dashed border with `signal-flicker`, `glow-breathe`, `scan-sweep`,
  `corner-jitter` — all running continuously while a candidate is tracked
- **Detected state**: `phosphor-bloom-glow` + `phosphor-bloom-border` + `corner-stamp` fire once,
  then the overlay holds steady with a fixed phosphor glow
- **Palette**: inherits from `--color-accent`, `--signal-glow`, `--signal-glow-soft`
- **Bloom peak color**: `--rect-bloom-peak: #fff3c0` (near-white phosphor at the lock moment)

---

## 8. State-Driven CSS Variables

Variables modified by JavaScript at the moment of match or unmatch. The HTML attribute
`data-state="matched"` is set on `<html>` by `applyConcertPalette()` and triggers the
`html[data-state='matched']` CSS block, which cascades new values down to all components.

| Variable                  | Trigger                   | Dead Signal Value            | Matched State Value                                          |
| ------------------------- | ------------------------- | ---------------------------- | ------------------------------------------------------------ |
| `--poster-bg`             | `MATCH_CONFIRMED`         | `#0a0800`                    | Generated by `getConcertPalette()` (HSL, 5% lightness)       |
| `--poster-primary`        | `MATCH_CONFIRMED`         | `#d4892a`                    | Generated palette primary (100% sat, 62–72% L)               |
| `--poster-accent`         | `MATCH_CONFIRMED`         | `#b87020`                    | Generated palette accent (100% sat, 58% L)                   |
| `--color-background`      | CSS cascade               | `#0a0800`                    | `var(--poster-bg)`                                           |
| `--color-main-text`       | CSS cascade               | `#d4892a`                    | `var(--poster-primary)`                                      |
| `--color-accent`          | CSS cascade               | `#d4892a`                    | `var(--poster-accent)`                                       |
| `--crt-opacity`           | CSS cascade               | `1`                          | `0`                                                          |
| `--texture-opacity`       | CSS cascade               | `0.1`                        | `0`                                                          |
| `--bg-gradient-top`       | CSS cascade               | `rgba(212, 137, 42, 0.16)`   | `transparent`                                                |
| `--signal-glow`           | CSS cascade               | `rgba(212, 137, 42, 0.34)`   | `color-mix(in srgb, var(--poster-primary), transparent 66%)` |
| `--font-family`           | CSS cascade               | `ui-monospace, 'SF Mono', …` | `-apple-system …, sans-serif`                                |
| `--exif-grain-opacity`    | JS (`exif-visual.ts`)     | `0.04`                       | `0.06–0.28` (ISO-driven)                                     |
| `--exif-transition-scale` | JS (`exif-visual.ts`)     | `1`                          | `0.6–1.4` (shutter speed driven)                             |
| `theme-color` meta tag    | JS (`concert-palette.ts`) | `#000000`                    | `palette.bg` (concert background color)                      |

**Mechanism**: CSS `transition: background-color 1.2s ease, color 1.2s ease` on `body`, and
`transition: opacity 1.2s ease` on `body::after`, ensure the dead-signal → matched transition
blends over ~1.2 seconds. JS writes custom properties; CSS handles the animation.
`updateThemeColor()` also updates `<meta name="theme-color">` so the browser status bar and
address bar chrome adapts to the matched concert palette (Android Chrome, Safari 15+).

---

## 9. Responsive Breakpoints

Mobile-first. Breakpoints use `max-width` media queries except where `min-width` is explicitly noted.

| Breakpoint | Width          | Notable changes                                                                                      |
| ---------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `xs`       | `≤360px`       | EXIF metadata row hidden in concert info overlay                                                     |
| `sm`       | `≤480px`       | Concert info overlay padding reduced; band name `clamp(2rem, 9vw, 4rem)`; meta `0.75rem`             |
| `md`       | `≥640px` (min) | Settings modal: border-radius enabled, padding increases                                             |
| `lg`       | `≤767px`       | Active layout padding reduced to zero; content padding tightens                                      |
| `xl`       | `≥768px` (min) | `--layout-content-max-width` expands `34rem → 44rem`; rectangle corners shrink `13→11px` at `≤768px` |

Camera square size formula: `max(6rem, min(100vw − 0.5rem, --layout-content-max-width, 100svh − 8rem))`.

---

## 10. Environmental Effect Variables

Implemented effects that drive CSS custom properties from runtime data. For the full backlog and
planned effects, see `docs/ENVIRONMENTAL_EFFECTS_IDEAS.md`.

| Effect                 | Data Source            | CSS Variable              | Range / Values                           | Feature Flag            |
| ---------------------- | ---------------------- | ------------------------- | ---------------------------------------- | ----------------------- |
| EXIF grain intensity   | `concert.iso`          | `--exif-grain-opacity`    | `0.06` (ISO 100) – `0.28` (ISO 3200+)    | `exif-visual-character` |
| EXIF transition timing | `concert.shutterSpeed` | `--exif-transition-scale` | `0.6` (1/500s fast) – `1.4` (1/30s slow) | `exif-visual-character` |

**Rules for all environmental effects**:

- JS writes CSS custom properties; CSS `transition` handles smooth blending
- All randomness has explicit min/max clamps
- Prefer per-session seeding over per-frame chaos
- Stochastic events use Poisson-style timers (~once per several minutes), never continuous noise
- Every effect must have a feature flag in `src/modules/secret-settings/config.ts`

---

## 11. Accessibility Constraints

| Constraint           | Specification                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focus ring           | `2px solid var(--focus-ring-color)`, offset `2px`; adapts to concert palette on matched state                                                                                             |
| Minimum touch target | `2.75rem` (≈ 44px) height and width on all interactive elements                                                                                                                           |
| Reduced motion       | `@media (prefers-reduced-motion: reduce)` sets `animation-duration: 0.01ms !important` and `transition-duration: 0.01ms !important` across all elements, effectively disabling animations |
| Color contrast       | Dead signal: `#d4892a` on `#0a0800` ≈ 9:1 (WCAG AA). Concert palette: `color-mix()` darkening ensures contrast is maintained across generated palettes                                    |
