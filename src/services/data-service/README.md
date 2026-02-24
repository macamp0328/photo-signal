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

  // Get all concerts by exact band name
  getConcertsByBand(band: string): Concert[];

  // Get specific concert by ID
  getConcertById(id: number): Concert | null;

  // Clear all in-memory caches
  clearCache(): void;

  // Advanced: inspect v2 load telemetry counters
  getDataSourceTelemetry(): {
    v2LoadAttempts: number;
    v2LoadFailures: number;
  };
}
```

**Side Effects**:

- Fetches from `/data.app.v2.json`
- Logs load details to aid debugging
- Emits v2 load telemetry counters via `getDataSourceTelemetry()`
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

// Get by band
const concertsByBand = dataService.getConcertsByBand('The Midnight Echoes');
```

---

## Data Source

**Current**: v2-only runtime

- Runtime artifact: `/data.app.v2.json`

### Data Integrity Contract

- `photoHashes.phash` is required for every concert entry consumed by runtime recognition
- `photoHashes.phash` must be a non-empty array of 16-character hexadecimal strings

**Future**: PostgreSQL via API route

### Migration Path

When migrating to PostgreSQL:

1. Add API route: `api/concerts.ts`
2. Update service URLs to point at `/api/concerts`
3. Zero changes to consuming modules

```typescript
// Before (current state)
const productionDataUrl = '/data.app.v2.json';
const developmentDataUrl = '/data.app.v2.json';

// After (PostgreSQL)
const productionDataUrl = '/api/concerts';
const developmentDataUrl = '/api/concerts';
```

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
