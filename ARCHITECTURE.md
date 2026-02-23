# Photo Signal - Architecture Documentation

> **Design Goal**: Modular, performant, AI-agent-friendly architecture optimized for parallel development and rapid iteration.

📚 **See also**: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for a complete list of all project documentation.

## Core Principles

1. **Performance First** - Native APIs, minimal dependencies, optimized bundle
2. **Cost Optimization** - Static hosting ($0), no backend required
3. **AI Agent Collaboration** - Clear contracts, isolated modules, zero coupling
4. **TypeScript Contracts** - Strong typing for reliable agent interaction
5. **Magical UX** - Instant responses, smooth transitions, delightful experience

---

## Architecture Evolution

### From Monolithic to Modular (2025)

Photo Signal was refactored from monolithic components to a modular architecture to enable parallel development and improve maintainability.

**Old Architecture (Before 2025):**

```
Camera.tsx (179 lines)
├── Camera access logic
├── Motion detection logic
├── Photo recognition logic
├── Data fetching
├── UI rendering
└── Permission handling
```

**Problems:**

- ❌ One file does too much (violates Single Responsibility Principle)
- ❌ Hard to test individual features in isolation
- ❌ Multiple developers would conflict on same file
- ❌ Difficult to replace just one feature (e.g., photo recognition algorithm)

**New Architecture (Current):**

```
modules/
├── camera-access/      (65 lines)   ← ONE job: manage camera stream
├── camera-view/        (88 lines)   ← ONE job: display video UI
├── motion-detection/   (105 lines)  ← ONE job: detect movement
└── photo-recognition/  (75 lines)   ← ONE job: match photos
```

**Benefits:**

- ✅ Each module has ONE clear responsibility
- ✅ Easy to test in isolation (unit tests per module)
- ✅ Multiple developers/agents work in parallel without conflicts
- ✅ Replace any module without touching others (e.g., swap recognition algorithm)
- ✅ Clear contracts via TypeScript interfaces
- ✅ Better code organization and discoverability

**Migration Mapping:**

| Old Component                | New Module(s)                                                                                                                  | Notes                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `Camera.tsx` (179 lines)     | `camera-access/` (65 lines)<br>`camera-view/` (88 lines)<br>`motion-detection/` (105 lines)<br>`photo-recognition/` (75 lines) | Split into 4 focused modules        |
| `AudioPlayer.tsx` (73 lines) | `audio-playback/` (113 lines)                                                                                                  | Enhanced with better controls       |
| `InfoDisplay.tsx` (36 lines) | `concert-info/` (54 lines)                                                                                                     | Slightly expanded with more options |

The new modular architecture achieved **100% feature parity** while improving code quality, testability, and developer experience.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     App Entry Point                      │
│                    (Orchestrator)                        │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Camera  │  │  Audio   │  │  Info    │
│  Module  │  │  Module  │  │  Module  │
└────┬─────┘  └────┬─────┘  └──────────┘
     │             │
     ▼             ▼
┌─────────────────────────────┐
│     Services Layer          │
├─────────────────────────────┤
│ • Photo Recognition Service │
│ • Motion Detection Service  │
│ • Data Service (concerts)   │
└─────────────────────────────┘
```

---

## Module Structure

Each module follows this pattern:

```
src/modules/{module-name}/
├── README.md           # API contract, usage, examples
├── index.ts            # Public API exports
├── types.ts            # TypeScript interfaces
├── {Module}.tsx        # React component (if UI)
└── {Service}.ts        # Business logic (if needed)
```

---

## Core Modules

### 1. Camera Access Module

**Location**: `src/modules/camera-access/`

**Purpose**: Acquire and manage camera stream

**Contract**:

```typescript
// Input: None (auto-request permissions)
// Output: MediaStream | null
// Side Effects: Requests camera permissions

interface CameraAccessHook {
  stream: MediaStream | null;
  error: string | null;
  hasPermission: boolean | null;
  retry: () => void;
}
```

**Dependencies**: None (Native MediaDevices API)

---

### 2. Motion Detection Module

**Location**: `src/modules/motion-detection/`

**Purpose**: Detect camera movement to trigger audio fade

**Contract**:

```typescript
// Input: MediaStream
// Output: boolean (isMoving)
// Side Effects: None (pure detection)

interface MotionDetectionHook {
  isMoving: boolean;
  sensitivity: number;
  setSensitivity: (value: number) => void;
}
```

**Algorithm**: Lightweight pixel difference between frames

**Dependencies**: None (Canvas API)

---

### 3. Photo Recognition Module

**Location**: `src/modules/photo-recognition/`

**Purpose**: Identify photos and match to concert data

**Contract**:

```typescript
// Input: MediaStream
// Output: Concert | null
// Side Effects: None (stateless matching)

interface PhotoRecognitionService {
  recognize(stream: MediaStream): Promise<Concert | null>;
  reset(): void;
}
```

**Current**: pHash perceptual hashing with functional frame cropping  
**Future**: Enhanced ML-based recognition

**Dependencies**: `data-service`

---

### 3a. Functional Framing Guides

**Location**: `src/modules/camera-view/` and `src/modules/photo-recognition/`

**Purpose**: Provide meaningful visual framing that functionally crops the analyzed region

The camera view displays a framing guide to help users align photos. This guide is **functionally meaningful** - the photo recognition module only analyzes pixels within the framed region.

**Benefits**:

- ✅ Eliminates background noise and clutter
- ✅ Reduces false positives from unrelated objects
- ✅ Improves recognition accuracy
- ✅ Makes framing guide intuitive and trustworthy
- ✅ Supports both landscape (3:2) and portrait (2:3) photos

**Aspect Ratios**:

- **3:2 (Landscape)**: Default, for horizontal photos
- **2:3 (Portrait)**: For vertical photos

**Data Flow with Functional Cropping**:

```
Camera Stream → Full Video Frame → Crop to Framed Region → pHash Pipeline
                                    ↑
                      Only analyzes pixels inside framing guide
                      (3:2 landscape OR 2:3 portrait)
```

**Implementation**:

1. CameraView renders framing overlay (CSS-based)
2. Photo recognition calculates framed region coordinates
3. Canvas extracts only the cropped region
4. pHash pipeline analyzes cropped pixels only
5. Matching compares cropped hash with reference hashes

**Cropping Logic**:

```typescript
function calculateFramedRegion(
  videoWidth: number,
  videoHeight: number,
  aspectRatio: '3:2' | '2:3'
): { x: number; y: number; width: number; height: number } {
  // Calculates centered crop region at 80% of viewport
  // Matches visual framing guide exactly
}
```

**Performance**:

- GPU-accelerated canvas cropping (no overhead)
- Smaller canvas = faster hash computation
- ~6-8ms per frame on mobile (same or faster than before)

---

### 4. Audio Playback Module

**Location**: `src/modules/audio-playback/`

**Purpose**: Play and control music with smooth fades

**Contract**:

```typescript
// Input: audioUrl: string, shouldPlay: boolean
// Output: PlaybackState
// Side Effects: Audio playback, volume changes

interface AudioPlaybackHook {
  play: (url: string) => void;
  pause: () => void;
  fadeOut: (duration: number) => void;
  isPlaying: boolean;
  volume: number;
}
```

**Implementation**: Native Audio API or minimal Howler.js wrapper

**Dependencies**: None

---

### 5. Concert Info Display Module

**Location**: `src/modules/concert-info/`

**Purpose**: Display concert metadata overlay

**Contract**:

```typescript
// Input: Concert | null, isVisible: boolean
// Output: React Component
// Side Effects: None (pure UI)

interface InfoDisplayProps {
  concert: Concert | null;
  isVisible: boolean;
  position?: 'top' | 'bottom';
}
```

**Dependencies**: None

---

## Service Layer

### Data Service

**Location**: `src/services/data-service/`

**Purpose**: Load and cache concert data

**Contract**:

```typescript
interface DataService {
  getConcerts(): Promise<Concert[]>;
  getConcertById(id: number): Concert | null;
  searchByImage(imageHash: string): Concert | null;
}
```

**Current runtime artifacts**:

- `/public/data.app.v2.json` (primary): normalized app metadata (`artists`, `photos`, `tracks`, `entries`)
- `/public/data.recognition.v2.json` (primary recognition path): compact hash index keyed by `concertId`
- `/public/data.json` (compatibility): legacy flat `concerts[]` payload

**Fallback behavior during rollout**:

- `DataService` attempts `/data.app.v2.json` first and falls back to `/data.json`.
- Photo recognition attempts `/data.recognition.v2.json` first and falls back to hash data attached to concerts.

**Phase C production policy controls**:

- `VITE_DATA_V2_FALLBACK_POLICY=warn|error`
  - `warn`: allow legacy fallback and log explicit fallback telemetry
  - `error`: treat missing v2 app artifact as startup-blocking in production
- `VITE_DATA_V2_REQUIRED=true|1` can be used as strict-mode alias when policy is not set

Default policy when not explicitly configured:

- `production` runtime + deploy env `production`/`unknown`: `error`
- `production` runtime + deploy env `preview`/`development`: `warn`
- `development`/`test` runtime: `warn`

Deploy env is resolved from `VITE_DEPLOY_ENV`, then `VERCEL_ENV`, then `unknown`.

**Fallback telemetry for cutover**:

- `v2LoadAttempts`
- `v2LoadFailures`
- `legacyFallbackLoads`
- `legacyFallbackLoadsInProduction`

These counters are exposed through `DataService` and logged when fallback is used.

**Deploy-time v2 artifact checks**:

- CI runs `npm run data:check-v2-artifacts` to validate required runtime artifacts:
  - `public/data.app.v2.json`
  - `public/data.recognition.v2.json`
- The check uses the same environment-based policy model:
  - production deploys default to `error`
  - preview/development deploys default to `warn`
- Optional override: `VITE_DATA_V2_ARTIFACT_POLICY=warn|error`

**Legacy removal criteria (post-rollout)**:

1. `legacyFallbackLoadsInProduction` remains zero for one full release window.
2. CI/deploy checks consistently publish `data.app.v2.json` and `data.recognition.v2.json`.
3. No active incidents reference missing/corrupt v2 artifacts.

This preserves backward compatibility while enabling v2 performance paths.

**Future**: PostgreSQL via API route

---

## Data Flow

```
1. User opens app
   ↓
2. Camera Access Module requests permissions
   ↓
3. App passes stream to Motion Detection + Photo Recognition
   ↓
4. Photo Recognition (after stability) → Concert match
   ↓
5. App triggers Audio Playback + Info Display
   ↓
6. Motion Detection senses movement → Fade audio
   ↓
7. Loop back to step 4
```

---

## AI Agent Collaboration Guide

### How Multiple Agents Work in Parallel

**Example Scenario**: Improve photo recognition AND enhance audio

**Agent 1** works on:

```
src/modules/photo-recognition/
  - Reads contract from README.md
  - Implements ML-based matching
  - Exports same PhotoRecognitionService interface
  - No need to touch other modules
```

**Agent 2** works on:

```
src/modules/audio-playback/
  - Reads contract from README.md
  - Adds crossfade, EQ, spatial audio
  - Exports same AudioPlaybackHook interface
  - No need to touch other modules
```

**Result**: Zero merge conflicts! Both agents work independently.

### Contract-First Development

1. **Agent reads module README** - Understands inputs, outputs, side effects
2. **Agent implements within module** - All logic stays isolated
3. **Agent exports documented interface** - TypeScript enforces contract
4. **Integration is automatic** - App orchestrator uses typed interfaces

---

## Performance Optimizations

### Bundle Size

- **Target**: < 100KB initial bundle (gzipped)
- **Strategy**:
  - Lazy load modules (code splitting)
  - Tree-shake unused code
  - Native APIs over libraries
  - Minimal dependencies

### Runtime Performance

- **Target**: 60 FPS camera feed, instant audio response
- **Strategy**:
  - Efficient motion detection (low-res sampling)
  - Debounced recognition checks
  - Audio preloading
  - Canvas optimizations

### Cost Optimization

- **Target**: $0/month hosting
- **Strategy**:
  - Static site deployment (Vercel/Netlify)
  - Client-side only (no serverless functions initially)
  - Future: Edge functions for PostgreSQL queries

---

## Technology Choices

| Layer      | Technology                   | Why                                                       |
| ---------- | ---------------------------- | --------------------------------------------------------- |
| Language   | TypeScript                   | Type safety, AI-friendly contracts                        |
| Framework  | React (minimal)              | Component reusability, could migrate to vanilla if needed |
| Build Tool | Vite                         | Fastest builds, instant HMR                               |
| Styling    | CSS Modules                  | Scoped styles, type-safe, zero runtime overhead           |
| Camera     | Native MediaDevices API      | Zero dependencies, maximum performance                    |
| Audio      | Native Audio API / Howler.js | Lightweight, robust playback                              |
| Data       | JSON → PostgreSQL            | Start simple, scale later                                 |
| Hosting    | Vercel                       | Free tier, edge network, perfect for static sites         |

---

## Migration Path to PostgreSQL

When scaling beyond static JSON:

1. Add API route in `api/concerts.ts` (Vercel serverless)
2. Connect to PostgreSQL (Supabase/Neon free tier)
3. Update Data Service to call API instead of fetch JSON
4. Zero changes to other modules (contract stays same!)

```typescript
// Before
const concerts = await fetch('/assets/test-data/concerts.json');

// After
const concerts = await fetch('/api/concerts');
```

---

## Development Workflow

### Adding a New Module

1. Create directory: `src/modules/new-module/`
2. Write contract first: `README.md` with API spec
3. Define types: `types.ts`
4. Implement logic: `Service.ts` or `Component.tsx`
5. Export public API: `index.ts`
6. Update this ARCHITECTURE.md
7. **Update DOCUMENTATION_INDEX.md** with link to the new module's README

### Modifying Existing Module

1. Read module's `README.md` contract
2. Make changes within module directory only
3. Ensure exported interface stays compatible
4. Update module's README if contract changes
5. Other modules remain untouched
6. **Update DOCUMENTATION_INDEX.md if files are added/removed/renamed**

---

## File Structure

```
photo-signal/
├── ARCHITECTURE.md          # This file
├── README.md                # User-facing docs
├── package.json
├── vite.config.ts
├── tsconfig.json
│
├── public/
│   ├── data.json           # Concert metadata
│   └── audio/              # Opus audio files
│
└── src/
    ├── App.tsx             # Orchestrator
    ├── main.tsx            # Entry point
    │
    ├── modules/
    │   ├── camera-access/
    │   │   ├── README.md
    │   │   ├── index.ts
    │   │   ├── types.ts
    │   │   └── useCameraAccess.ts
    │   │
    │   ├── motion-detection/
    │   │   ├── README.md
    │   │   ├── index.ts
    │   │   ├── types.ts
    │   │   └── useMotionDetection.ts
    │   │
    │   ├── photo-recognition/
    │   │   ├── README.md
    │   │   ├── index.ts
    │   │   ├── types.ts
    │   │   └── PhotoRecognitionService.ts
    │   │
    │   ├── audio-playback/
    │   │   ├── README.md
    │   │   ├── index.ts
    │   │   ├── types.ts
    │   │   └── useAudioPlayback.ts
    │   │
    │   └── concert-info/
    │       ├── README.md
    │       ├── index.ts
    │       ├── types.ts
    │       └── InfoDisplay.tsx
    │
    ├── services/
    │   └── data-service/
    │       ├── README.md
    │       ├── index.ts
    │       ├── types.ts
    │       └── DataService.ts
    │
    └── types/
        └── index.ts        # Shared types (Concert, etc.)
```

---

## Testing Strategy

Each module can be tested in isolation:

```typescript
// Example: Motion Detection Test
import { useMotionDetection } from '@/modules/motion-detection';

test('detects movement when pixels change significantly', () => {
  const mockStream = createMockVideoStream();
  const { isMoving } = useMotionDetection(mockStream);

  simulateMovement(mockStream);
  expect(isMoving).toBe(true);
});
```

No need to spin up entire app for isolated tests.

---

## Future Enhancements

- [ ] Real ML-based photo recognition
- [ ] PostgreSQL backend for concert data
- [ ] User accounts (save favorites)
- [ ] PWA offline support
- [ ] External speaker integration (ESP32, Google Home)
- [ ] Audio-reactive visual effects
- [ ] Story mode (text reflections after song)
- [ ] Multi-language support

Each can be built by a separate AI agent without conflicts! 🎉
