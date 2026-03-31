# Gallery Layout

Top-level layout component providing the zine/gig-poster aesthetic: a full-bleed camera frame,
a tap-to-activate landing state, a settings icon, and optional audio controls at the bottom.

## API

```tsx
<GalleryLayout
  isActive={boolean}
  cameraView={ReactNode}
  onActivate={() => void}
  onSettingsClick={() => void}
  audioControls?={ReactNode}
  isMatchedPhoto?={boolean}
  aboveCameraSlot?={ReactNode}
  belowCameraSlot?={ReactNode}
/>
```

`isActive` — whether the camera is live. When `false`, renders a tap-to-start landing screen.
`isMatchedPhoto` — when `true`, the camera frame expands to a natural aspect ratio to show a matched photo.
`aboveCameraSlot` — optional node rendered above the camera frame (e.g., concert info overlay).
`belowCameraSlot` — optional node rendered below the camera frame (e.g., action buttons).

## Responsibilities

- Orchestrating the landing → active → matched visual states
- Providing the layout shell (header, camera frame, bottom controls strip)
- Rendering the settings icon button

## Does NOT Own

- Camera acquisition (`camera-access`)
- Recognition (`photo-recognition`)
- Audio controls (passed in as `audioControls` slot)

## Dependencies

- React `ReactNode` for composition slots

## Key Files

- `GalleryLayout.tsx` — component, state-based layout rendering
- `GalleryLayout.module.css` — full-bleed layout, CRT scan-line effects, state transitions
- `types.ts` — `GalleryLayoutProps`
