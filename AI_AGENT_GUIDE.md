# AI Agent Collaboration Examples

📚 **See also**: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for a complete list of all project documentation.

This document demonstrates how multiple AI agents can work on Photo Signal simultaneously without conflicts.

## Example 1: Photo Recognition + Audio Enhancement

### Scenario

You want to upgrade from placeholder photo recognition to ML-based recognition AND add audio crossfade effects.

### Agent 1: ML Photo Recognition

**Works in**: `src/modules/photo-recognition/`

**Task**: Replace placeholder with TensorFlow.js model

**Changes**:

```typescript
// src/modules/photo-recognition/usePhotoRecognition.ts

// Add TensorFlow.js
import * as tf from '@tensorflow/tfjs';

export function usePhotoRecognition(stream, options) {
  // Load ML model
  const model = useRef<tf.LayersModel | null>(null);

  useEffect(() => {
    loadModel();
  }, []);

  // Replace placeholder with real recognition
  const recognizePhoto = async () => {
    const frame = captureFrame(stream);
    const predictions = await model.current.predict(frame);
    return matchConcert(predictions);
  };

  // Same interface exported - no changes needed elsewhere!
  return { recognizedConcert, isRecognizing, reset };
}
```

**Files touched**:

- `src/modules/photo-recognition/usePhotoRecognition.ts`
- `src/modules/photo-recognition/README.md` (update algorithm section)
- `package.json` (add @tensorflow/tfjs)

**No conflicts with**: Any other module

---

### Agent 2: Audio Crossfade

**Works in**: `src/modules/audio-playback/`

**Task**: Add crossfade between tracks

**Changes**:

```typescript
// src/modules/audio-playback/useAudioPlayback.ts

export function useAudioPlayback(options) {
  // Add crossfade method
  const crossfade = useCallback((newUrl: string, duration = 2000) => {
    const oldSound = soundRef.current;
    const newSound = new Howl({ src: [newUrl], volume: 0 });

    // Fade out old
    oldSound?.fade(oldSound.volume(), 0, duration);

    // Fade in new
    newSound.play();
    newSound.fade(0, 0.8, duration);

    soundRef.current = newSound;
  }, []);

  // Enhanced interface
  return { play, pause, stop, fadeOut, crossfade, isPlaying, volume, setVolume };
}
```

**Files touched**:

- `src/modules/audio-playback/useAudioPlayback.ts`
- `src/modules/audio-playback/types.ts` (add crossfade to interface)
- `src/modules/audio-playback/README.md` (document crossfade)

**No conflicts with**: Photo recognition module

---

### Result: ZERO CONFLICTS! 🎉

Both agents push their changes simultaneously. The only integration point is `App.tsx`, which can be updated by either agent or a third orchestrator agent.

---

## Example 2: Motion Detection + UI Enhancements

### Scenario

Improve motion detection algorithm AND add new UI overlay effects.

### Agent 1: Advanced Motion Detection

**Works in**: `src/modules/motion-detection/`

**Task**: Add directional movement detection

**Changes**:

```typescript
// src/modules/motion-detection/useMotionDetection.ts

export function useMotionDetection(stream, options) {
  const [direction, setDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  const detectMovement = useCallback(() => {
    // Enhanced algorithm with direction
    const { isMoving, direction } = analyzeFrameDirection(currentFrame, previousFrame);
    setIsMoving(isMoving);
    setDirection(direction);
  }, []);

  return { isMoving, direction, sensitivity, setSensitivity };
}
```

**Files touched**:

- `src/modules/motion-detection/useMotionDetection.ts`
- `src/modules/motion-detection/types.ts`
- `src/modules/motion-detection/README.md`

---

### Agent 2: Enhanced UI Overlays

**Works in**: `src/modules/concert-info/`

**Task**: Add animated concert photo background

**Changes**:

```typescript
// src/modules/concert-info/InfoDisplay.tsx

export function InfoDisplay({ concert, isVisible, position }) {
  return (
    <div className="...">
      {/* New: Blurred photo background */}
      <div className="absolute inset-0 bg-cover blur-xl opacity-30"
           style={{ backgroundImage: `url(${concert.photoUrl})` }} />

      <div className="relative z-10">
        <h1>{concert.band}</h1>
        <p>{concert.venue}</p>
        <p>{formatDate(concert.date)}</p>
      </div>
    </div>
  );
}
```

**Files touched**:

- `src/modules/concert-info/InfoDisplay.tsx`
- `src/modules/concert-info/README.md`
- `src/types/index.ts` (add photoUrl to Concert)

---

### Result: MINIMAL CONFLICTS

Only potential conflict: Both agents might update `src/types/index.ts` to add fields to Concert interface. Easy to resolve by combining changes.

---

## Example 3: Data Migration to PostgreSQL

### Scenario

Move from static JSON to PostgreSQL database.

### Agent 1: Database Agent

**Works in**: `src/services/data-service/`

**Task**: Migrate to PostgreSQL

**Changes**:

```typescript
// src/services/data-service/DataService.ts

class DataService {
  private readonly dataUrl = '/api/concerts'; // Changed from /data.json

  async getConcerts(): Promise<Concert[]> {
    if (this.cache) return this.cache;

    // Same fetch, different URL!
    const response = await fetch(this.dataUrl);
    const data = await response.json();
    this.cache = data.concerts;
    return this.cache;
  }
}

// api/concerts.ts (new file)
export async function GET() {
  const concerts = await db.query('SELECT * FROM concerts');
  return Response.json({ concerts });
}
```

**Files touched**:

- `src/services/data-service/DataService.ts`
- `api/concerts.ts` (new)
- `src/services/data-service/README.md`

**No changes needed in**:

- Any module that uses data-service
- App.tsx
- UI components

---

## Example 4: Multiple Agents, One Feature

### Scenario

Add "favorite concerts" feature with UI, storage, and filtering.

### Agent 1: Favorites Logic

**Works in**: `src/modules/favorites/` (new)

**Creates**:

```
src/modules/favorites/
├── README.md (contract: manage favorite state)
├── useFavorites.ts (hook for managing favorites)
└── types.ts (FavoritesState interface)
```

---

### Agent 2: Favorites UI

**Works in**: `src/modules/favorites-ui/` (new)

**Creates**:

```
src/modules/favorites-ui/
├── README.md (contract: display favorites button)
├── FavoriteButton.tsx (heart icon component)
└── types.ts (button props)
```

---

### Agent 3: Local Storage

**Works in**: `src/services/storage-service/` (new)

**Creates**:

```
src/services/storage-service/
├── README.md (contract: persist favorites)
├── StorageService.ts (localStorage wrapper)
└── types.ts (storage interface)
```

---

### Agent 4: Integration

**Works in**: `src/App.tsx`

**Integrates**:

```typescript
import { useFavorites } from './modules/favorites';
import { FavoriteButton } from './modules/favorites-ui';

function App() {
  const { favorites, toggleFavorite } = useFavorites();

  return (
    <>
      <CameraView ... />
      <InfoDisplay ... />
      <FavoriteButton
        concert={recognizedConcert}
        isFavorite={favorites.includes(recognizedConcert?.id)}
        onToggle={toggleFavorite}
      />
    </>
  );
}
```

---

### Result: 4 AGENTS, PARALLEL WORK ⚡

All agents work simultaneously:

- No file overlaps
- Clear contracts via README.md
- TypeScript enforces interfaces
- Final integration takes < 5 minutes

---

## Key Principles for Parallel Development

1. **One Agent, One Module** - Each agent "owns" a module directory
2. **Contract First** - Write README.md before code
3. **Type Safety** - TypeScript prevents integration issues
4. **Export Interfaces** - Public API is explicit and documented
5. **Zero Side Effects** - Modules don't modify global state
6. **Test Independently** - Each module can be tested in isolation

---

## Conflict Resolution Patterns

### When conflicts occur (rare):

**Scenario**: Two agents both update `src/types/index.ts`

**Agent A** adds:

```typescript
export interface Concert {
  // ... existing fields
  photoHash: string; // Added by Agent A
}
```

**Agent B** adds:

```typescript
export interface Concert {
  // ... existing fields
  duration: number; // Added by Agent B
}
```

**Resolution**:

```typescript
export interface Concert {
  // ... existing fields
  photoHash: string; // From Agent A
  duration: number; // From Agent B
}
```

Simple merge - TypeScript will catch any integration issues at compile time!

---

## Benefits Summary

✅ **Parallel Development** - N agents can work simultaneously  
✅ **Clear Boundaries** - Module ownership prevents stepping on toes  
✅ **Type Safety** - Compile-time integration validation  
✅ **Documented Contracts** - Each module's README is the source of truth  
✅ **Easy Refactoring** - Replace entire modules without touching others  
✅ **Minimal Conflicts** - Only shared types need coordination  
✅ **Fast Integration** - Well-defined interfaces make wiring trivial

---

This architecture turns AI agent development from sequential to parallel, multiplying productivity! 🚀
