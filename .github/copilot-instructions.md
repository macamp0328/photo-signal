# GitHub Copilot Instructions for photo-signal

## Project Overview

Photo Signal is a mobile-first web application that creates an interactive, camera-based gallery experience. Users point their phone's camera at printed photographs, and the app recognizes the image, displays concert information (band, venue, date), and plays associated music. The project emphasizes quiet, seamless interaction with physical media without using QR codes or visible markers.

## Tech Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **Audio**: Howler.js
- **Type Safety**: TypeScript 5.9 with strict mode
- **Code Quality**: ESLint (flat config) + Prettier
- **Deployment**: Vercel
- **CI/CD**: GitHub Actions

## Architecture

This is a client-side only application with no backend:

- All logic runs in the browser
- Static assets served from `/public`
- Concert data stored in `/public/data.json`
- Audio files stored in `/public/audio/`
- Photo recognition currently uses placeholder logic (3-second delay)

## Code Style & Standards

### TypeScript

- Use strict mode - all strict options are enabled
- No implicit `any` types
- Define proper interfaces in `src/types.ts`
- Use type annotations for function parameters and return types

### React Patterns

- Use functional components with hooks
- Use `useCallback` for event handlers to prevent unnecessary re-renders
- Use `useRef` for DOM references and mutable values
- Use `useState` for component state
- Interfaces for component props should be defined above the component

### Naming Conventions

- Components: PascalCase (e.g., `Camera.tsx`, `AudioPlayer.tsx`)
- Files: PascalCase for React components, camelCase for utilities
- Props interfaces: `ComponentNameProps` (e.g., `CameraProps`)
- Types/Interfaces: PascalCase, defined in `src/types.ts` or co-located with component

### Styling

- Use Tailwind CSS utility classes
- Mobile-first responsive design
- Full viewport height/width patterns: `w-full h-full`
- Use `className` prop for styling

### Code Quality

- Run `npm run lint` before committing
- Run `npm run format` to auto-format with Prettier
- Prettier config: 2-space indentation, single quotes, semicolons, 100-char line width
- No ESLint warnings or errors allowed in CI

## Development Workflow

### Available Commands

```bash
npm run dev          # Start development server (port 5173)
npm run build        # Build for production (tsc + vite build)
npm run preview      # Preview production build
npm run lint         # Check for linting errors
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format all files with Prettier
npm run format:check # Check if files are formatted
npm run type-check   # Run TypeScript type checking
```

### Before Committing

Always run these checks:

```bash
npm run lint:fix
npm run format
npm run type-check
npm run build
```

### CI Requirements

All PRs must pass:

1. ESLint (with max 0 warnings)
2. Prettier formatting check
3. TypeScript type check
4. Production build

## Key Components

### Camera (`src/components/Camera.tsx`)

- Requests rear camera with `facingMode: 'environment'`
- Displays 3:2 aspect ratio overlay with corner markers
- Implements motion detection using frame comparison (checks every 500ms)
- Calls `onPhotoRecognized` after 3-second delay (placeholder recognition)
- Calls `onMovement` when significant camera movement detected
- Handles camera permissions and error states

### AudioPlayer (`src/components/AudioPlayer.tsx`)

- Uses Howler.js for audio playback
- Implements fade-out (1 second) when `shouldPlay` becomes false
- Calls `onFadeComplete` callback when fade finishes
- Sets volume to 80%

### InfoDisplay (`src/components/InfoDisplay.tsx`)

- Shows concert information overlay (band, venue, date)
- Smooth fade-in/out transitions
- Gradient background for readability

### App (`src/App.tsx`)

- Main orchestrator component
- Manages state for `recognizedConcert`, `showInfo`, `playAudio`
- Coordinates between Camera, InfoDisplay, and AudioPlayer
- Uses `useCallback` for all handlers

## Data Structure

### Concert Type (`src/types.ts`)

```typescript
interface Concert {
  id: number;
  band: string;
  venue: string;
  date: string;
  audioFile: string;
}
```

### Concert Data (`public/data.json`)

JSON file with array of concert objects. Audio files referenced as paths like `/audio/sample.mp3`.

## Important Considerations

### Mobile-First

- Design for mobile/touch devices first
- Use `playsInline` attribute for video elements
- Request camera permissions properly
- Consider network constraints for audio loading

### Camera Handling

- Always check for `videoRef.current` before accessing video element
- Clean up media streams in useEffect cleanup
- Handle permission denied gracefully with user-friendly error messages

### Audio Handling

- Load audio files only when needed
- Implement smooth fade-out transitions
- Handle missing audio files gracefully
- Consider user interaction requirements for autoplay

### Performance

- Use lower resolution for motion detection (1/4 scale)
- Debounce/throttle expensive operations
- Clean up timers and intervals in useEffect cleanup
- Minimize re-renders with useCallback and useMemo

## Common Tasks

### Adding a New Concert

1. Add MP3 file to `/public/audio/`
2. Add concert entry to `/public/data.json`
3. Test by pointing camera at corresponding photo

### Modifying Recognition Logic

Currently placeholder logic in `Camera.tsx` (`useEffect` with 3-second timeout). To implement real recognition, integrate perceptual hashing or ML-based matching in this section.

### Styling Updates

Use Tailwind utility classes. Configuration in `tailwind.config.js`. For custom styles, add to `src/index.css`.

## Testing Locally

1. Install dependencies: `npm install`
2. Add sample audio: place MP3 at `/public/audio/sample.mp3`
3. Start dev server: `npm run dev`
4. Open on mobile device or use browser dev tools device emulation
5. Grant camera permissions
6. Point camera at any photo to trigger recognition after 3 seconds

## Future Enhancements

Potential areas for contribution:

- Real photo recognition using perceptual hashing (image-phash)
- PWA functionality for offline support
- Audio-reactive visual effects
- External playback integration (ESP32, Google Home)
- Story mode with written reflections
- Backend integration for dynamic content

## Helpful Resources

- Project README: `README.md`
- Setup documentation: `SETUP.md`
- Type definitions: `src/types.ts`
- CI workflow: `.github/workflows/ci.yml`
