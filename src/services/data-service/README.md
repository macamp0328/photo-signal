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

- Fetches from `/data.json` in production builds and `/assets/test-data/concerts.dev.json` in development/test or when Secret Settings enables Test Data Mode
- Logs which dataset is active to aid debugging
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

**Current**: Split datasets

- **Production**: `/data.json` (bundled from `assets/test-data/concerts.prod.json`)
- **Development/Test**: `/assets/test-data/concerts.dev.json` (complete dataset with stress cases)
- **Test Data Mode**: Forces development dataset even in production builds

**Future**: PostgreSQL via API route

### Migration Path

When migrating to PostgreSQL:

1. Add API route: `api/concerts.ts`
2. Update the mode-specific URLs in the service to point at `/api/concerts`
3. Zero changes to consuming modules!

```typescript
// Before (current state)
const productionDataUrl = '/data.json';
const developmentDataUrl = '/assets/test-data/concerts.dev.json';

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
