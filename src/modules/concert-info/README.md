# Concert Info

Displays concert metadata (band, venue, date, EXIF) as a caption strip above the matched photo.

## API

```tsx
<InfoDisplay concert={Concert | null} isVisible={boolean} />
```

`concert` — the matched `Concert` from `src/types/index.ts`. Pass `null` to suppress content.
`isVisible` — controls visibility independently of whether a concert is loaded.

## Responsibilities

- Rendering band name, venue, date, and EXIF metadata from a `Concert` object
- Applying the per-concert CSS custom properties set by `src/utils/concert-palette.ts`
- Animated entrance transition tied to `isVisible`

## Does NOT Own

- Deciding _which_ concert to show (that's `App.tsx` via `photo-recognition`)
- Generating the color palette (that's `src/utils/concert-palette.ts`)
- Audio playback (that's `audio-playback`)

## Dependencies

- `Concert` type from `src/types/index.ts`
- Concert palette CSS custom properties set on `<html>` by `concert-palette.ts`

## Key Files

- `InfoDisplay.tsx` — component
- `InfoDisplay.module.css` — caption strip layout and typography
- `types.ts` — `InfoDisplayProps`
