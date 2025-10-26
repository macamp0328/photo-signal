# Project Setup Documentation

## Overview

This project is configured with a modern development workflow including:

- **Vite** - Fast build tool and dev server
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Howler.js** - Audio playback library
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Add an MP3 file:**

   Place your MP3 file at `public/audio/sample.mp3` or update the `audioFile` paths in `public/data.json`

3. **Start development server:**

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000 (or another port if 3000 is in use)

4. **Run linting:**

   ```bash
   npm run lint
   npm run lint:fix  # Auto-fix issues
   ```

5. **Check formatting:**

   ```bash
   npm run format:check
   npm run format  # Auto-format all files
   ```

6. **Type-check:**

   ```bash
   npm run type-check
   ```

7. **Build for production:**

   ```bash
   npm run build
   ```

8. **Preview production build:**
   ```bash
   npm run preview
   ```

## Project Structure

```
photo-signal/
├── public/
│   ├── audio/           # MP3 files
│   ├── data.json        # Concert data
│   └── vite.svg         # Favicon
├── src/
│   ├── components/
│   │   ├── AudioPlayer.tsx    # Howler.js audio player
│   │   ├── Camera.tsx         # Camera with motion detection
│   │   └── InfoDisplay.tsx    # Concert info overlay
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   ├── types.ts         # TypeScript types
│   └── index.css        # Global styles with Tailwind
├── scripts/
│   └── create-sample-audio.sh # Helper to create sample audio
├── eslint.config.js     # ESLint configuration (flat config format)
├── .prettierrc.json     # Prettier configuration
├── .prettierignore      # Files to ignore in formatting
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── tsconfig.app.json    # App TypeScript config
├── tsconfig.node.json   # Node TypeScript config
├── postcss.config.js    # PostCSS configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── vite.config.ts       # Vite configuration
```

## Code Quality Standards

### ESLint Rules:

- Recommended JavaScript rules
- TypeScript strict rules
- React Hooks rules
- React Refresh for HMR
- Prettier integration

### Prettier Configuration:

- 2 space indentation
- Single quotes
- Semicolons required
- Trailing commas (ES5)
- 100 character line width
- LF line endings

### TypeScript:

- Strict mode enabled
- No implicit any
- Strict null checks
- All strict options enabled

## Features

### Mobile-First Design

- Optimized for mobile devices with touch support
- Responsive layout
- Full-screen camera view

### Camera Component

- Requests rear camera with `facingMode: 'environment'`
- 3:2 aspect ratio overlay with corner markers
- Motion detection using frame comparison
- Placeholder photo recognition logic (3 second delay)
- Fetches concert data from `data.json`
- Error handling for camera permissions

### Audio Playback

- Uses Howler.js for audio playback
- Fade-out on movement detection (1 second)
- Graceful handling of missing audio files
- Volume set to 80%

### Info Display

- Shows band name, venue, and date
- Smooth fade-in/out transitions
- Gradient overlay background

## Best Practices

1. **Before Committing:**

   ```bash
   npm run lint:fix
   npm run format
   npm run type-check
   npm run build
   ```

2. **Development Workflow:**
   - Create feature branch
   - Make changes
   - Run linting and formatting
   - Test in browser
   - Build to verify
   - Commit and push

## Troubleshooting

### Port Already in Use

If port 3000 is in use, Vite will automatically use the next available port.

### Build Fails

1. Clear cache: `rm -rf node_modules dist`
2. Reinstall: `npm install`
3. Try building again: `npm run build`

### Linting Errors

1. Run `npm run lint` to see errors
2. Run `npm run lint:fix` to auto-fix
3. Manually fix remaining issues

### Type Errors

1. Run `npm run type-check`
2. Fix type issues in the reported files
3. Ensure all imports have proper types

## Configuration

### Concert Data

Edit `public/data.json` to add your own concert data:

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "Band Name",
      "venue": "Venue Name",
      "date": "2023-08-15",
      "audioFile": "/audio/sample.mp3"
    }
  ]
}
```

### Photo Recognition

The current implementation uses placeholder logic that triggers after 3 seconds. To implement real photo recognition, modify the `Camera.tsx` component to integrate with your preferred image recognition service (e.g., perceptual hashing or ML-based matching).

## Security

- No secrets exposed in code
- Dependencies are regularly audited
- All dependencies are locked in `package-lock.json`
- Camera and audio permissions handled securely
