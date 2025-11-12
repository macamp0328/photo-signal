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

**Current**: Placeholder (3s delay simulation)  
**Future**: ML-based perceptual hashing

**Dependencies**: `data-service`

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

**Current**: Static JSON from `/public/data.json`  
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
const concerts = await fetch('/data.json');

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
│   └── audio/              # MP3 files
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
