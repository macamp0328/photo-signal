# Gallery Layout Module

## Overview

The Gallery Layout module provides a zine-like, curated UI experience for Photo Signal, inspired by campmiles.com. It creates a sophisticated gallery interface that moves away from the traditional full-screen camera view to a more engaging, editorial-style layout.

## Features

- **Landing View**: Initial screen with title, instructions, and "Begin" button
- **Active Gallery View**: Integrated camera view with header and side panel for concert info
- **Textured Background**: Paper-like aesthetic throughout the experience
- **Responsive Layout**: Adapts to mobile and desktop screens
- **Modular Design**: Accepts camera and info display as children components

## API

### Component: `GalleryLayout`

```typescript
interface GalleryLayoutProps {
  /** Whether the camera is active */
  isActive: boolean;

  /** Camera view component to render */
  cameraView: ReactNode;

  /** Info display component to render */
  infoDisplay: ReactNode;

  /** Callback when user wants to activate camera */
  onActivate: () => void;

  /** Whether to show the info section (defaults to false for overlay mode) */
  showInfoSection?: boolean;
}
```

**Note**: The `showInfoSection` prop is optional and defaults to `false`. When `false`, the info section is hidden, allowing concert info to be displayed as an overlay on the camera view instead. This prevents the layout from changing when a photo is matched, which could disrupt photo recognition.

## Usage

### Basic Usage (Overlay Mode - Recommended)

```tsx
import { GalleryLayout } from './modules/gallery-layout';

function App() {
  const [isActive, setIsActive] = useState(false);

  // Concert info is now passed directly to CameraView for overlay display
  const cameraView = (
    <CameraView
      stream={stream}
      concertInfo={recognizedConcert}
      showConcertOverlay={!!recognizedConcert && isPlaying}
    />
  );

  const infoDisplay = <InfoDisplay concert={null} isVisible={false} />;

  return (
    <GalleryLayout
      isActive={isActive}
      cameraView={cameraView}
      infoDisplay={infoDisplay}
      onActivate={() => setIsActive(true)}
      showInfoSection={false} // Hide info section, use overlay instead
    />
  );
}
```

### Legacy Usage (Side Panel Mode)

```tsx
import { GalleryLayout } from './modules/gallery-layout';

function App() {
  const [isActive, setIsActive] = useState(false);

  const cameraView = <CameraView stream={stream} />;
  const infoDisplay = <InfoDisplay concert={concert} />;

  return (
    <GalleryLayout
      isActive={isActive}
      cameraView={cameraView}
      infoDisplay={infoDisplay}
      onActivate={() => setIsActive(true)}
      showInfoSection={true} // Show info section in side panel
    />
  );
}
```

## Design Inspiration

The layout is inspired by campmiles.com and features:

- Textured, off-white/light-gray background
- Asymmetrical, curated layouts
- Clean typography with custom color palette
- Distinct content blocks with borders and shadows

## States

### Landing View (`isActive = false`)

- Centered title and instructions
- "Begin" button to activate camera
- Textured background creates physical, zine-like feel

### Active Gallery View (`isActive = true`)

- Header with title and subtitle
- Camera view in main content area
- Info display in side panel (desktop) or below (mobile)
- Maintains textured background aesthetic

## Accessibility

- Semantic HTML structure
- Keyboard accessible button
- Responsive design for all screen sizes
- Clear visual hierarchy

## Future Enhancements

The modular architecture supports future AR features:

- Visual overlays that react to music
- Interactive elements in the info panel
- Spatial awareness for AR content
- Additional layout variations

## Dependencies

- React 19+
- CSS Modules (`GalleryLayout.module.css`)
- Custom CSS variables in `src/index.css` for color palette
- No external UI libraries

## Related Modules

- `camera-view`: Provides the camera feed component
- `concert-info`: Provides the info display component
- Global styles in `src/index.css` for textured background
