# Data Service

## Purpose

Load and manage concert data.

## Responsibility

**ONLY** handles:

- Loading concert data from JSON or API
- Caching data in memory
- Providing query methods

**Does NOT** handle:

- Photo recognition logic (see `photo-recognition` module)
- UI display (see `concert-info` module)
- Audio playback (see `audio-playback` module)

---

## API Contract

### Service: `DataService`

**Methods**:

```typescript
class DataService {
  // Load all concerts (cached after first call)
  getConcerts(): Promise<Concert[]>;

  // Get specific concert by ID
  getConcertById(id: number): Concert | null;

  // Search concerts (placeholder for future image hash matching)
  search(query: string): Concert[];
}
```

**Side Effects**:

- Fetches from `/data.app.v2.json` first and falls back to `/data.json` when allowed
- Logs which dataset is active to aid debugging
- Emits fallback telemetry counters via `getDataSourceTelemetry()`
- Caches results in memory
- Future: Will query PostgreSQL API

---

## Usage Example

```typescript
import { dataService } from '@/services/data-service';

// Get all concerts
const concerts = await dataService.getConcerts();

// Get specific concert
const concert = dataService.getConcertById(1);

// Search
const results = dataService.search('Fillmore');
```

---

## Data Source

**Current**: v2-first runtime with compatibility fallback

- **Primary (all modes)**: `/data.app.v2.json`
- **Compatibility fallback**: `/data.json`
- **Test Data Mode**: Retained for feature toggles; data source remains v2-first

### Phase C startup policy controls

`DataService` supports production fallback policy configuration:

- `VITE_DATA_V2_FALLBACK_POLICY=warn|error`
  - `warn` (default): logs fallback and loads `/data.json`
  - `error`: blocks fallback in production and returns empty data (startup failure path)
- `VITE_DATA_V2_REQUIRED=true|1`
  - Alias for strict mode (`error`) when `VITE_DATA_V2_FALLBACK_POLICY` is not set

### Fallback telemetry

Use `getDataSourceTelemetry()` to inspect fallback rollout usage:

- `v2LoadAttempts`
- `v2LoadFailures`
- `legacyFallbackLoads`
- `legacyFallbackLoadsInProduction`

### Data Integrity Contract

- `photoHashes.phash` is required for every concert entry consumed by runtime recognition
- `photoHashes.phash` must be a non-empty array of 16-character hexadecimal strings

**Future**: PostgreSQL via API route

### Migration Path

When migrating to PostgreSQL:

1. Add API route: `api/concerts.ts`
2. Update the mode-specific URLs in the service to point at `/api/concerts`
3. Zero changes to consuming modules!

```typescript
// Before (current state)
const productionDataUrl = '/data.app.v2.json';
const developmentDataUrl = '/data.app.v2.json';

// After (PostgreSQL)
const productionDataUrl = '/api/concerts';
const developmentDataUrl = '/api/concerts';
```

### Legacy fallback removal criteria

Keep `/data.json` fallback for one release window, then remove only when all criteria hold:

1. Production telemetry shows `legacyFallbackLoadsInProduction === 0` for the full window.
2. Deploy checks confirm `/public/data.app.v2.json` and `/public/data.recognition.v2.json` are always published.
3. No open incidents tied to missing/invalid v2 artifacts.

---

## Performance

- **Caching**: Data loaded once, cached in memory
- **No unnecessary fetches**: Smart cache invalidation
- **Future**: Edge caching with Vercel

---

## Future Enhancements

- [ ] PostgreSQL integration
- [ ] Image hash indexing for fast lookups
- [ ] User favorites/history
- [ ] Real-time updates via WebSocket
- [ ] Multi-tenancy (multiple galleries)

---

## Dependencies

- `types` module (Concert interface)
