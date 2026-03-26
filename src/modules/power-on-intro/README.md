# Power-On Intro

Old-TV startup sequence shown after the `Turn On` gesture and before the `Still Broadcasting.` landing screen.

## API

```tsx
<PowerOnIntro onComplete={() => void} />
```

`onComplete` — called when the timed startup sequence ends and the app should hand off to the landing screen.

## Responsibilities

- Rendering the timed power-on boot sequence
- Respecting reduced-motion preferences with a shortened handoff
- Attempting the startup hum after the user has already pressed `Turn On`

## Does NOT Own

- The passcode gate (`App.tsx`)
- The post-intro landing screen (`gallery-layout`)
- Camera activation (`Tune in` remains the only path to `ACTIVE`)

## Dependencies

- React hooks for timing and cleanup
- CSS Modules for the boot-sequence visuals

## Key Files

- `PowerOnIntro.tsx` — component and timing orchestration
- `PowerOnIntro.module.css` — startup visuals and phase styling
- `types.ts` — public prop contract
