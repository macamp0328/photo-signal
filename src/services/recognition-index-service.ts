export interface RecognitionIndexEntryV2 {
  concertId: number;
  phash: string[];
}

interface RecognitionIndexPayloadV2 {
  version: 2;
  entries: RecognitionIndexEntryV2[];
}

const RECOGNITION_INDEX_URL = '/data.recognition.v2.json';

let cachedEntries: RecognitionIndexEntryV2[] | null = null;
let inFlightLoad: Promise<RecognitionIndexEntryV2[]> | null = null;
let cacheGeneration = 0;

function isRecognitionIndexPayloadV2(payload: unknown): payload is RecognitionIndexPayloadV2 {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const asPayload = payload as Partial<RecognitionIndexPayloadV2>;
  return asPayload.version === 2 && Array.isArray(asPayload.entries);
}

export async function getRecognitionIndexEntries(): Promise<RecognitionIndexEntryV2[]> {
  if (cachedEntries) {
    return cachedEntries;
  }

  if (inFlightLoad) {
    return inFlightLoad;
  }

  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable while loading recognition index');
  }

  const loadGeneration = cacheGeneration;

  inFlightLoad = fetch(RECOGNITION_INDEX_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${RECOGNITION_INDEX_URL}: HTTP ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      if (!isRecognitionIndexPayloadV2(payload)) {
        throw new Error(`Invalid recognition index payload: expected ${RECOGNITION_INDEX_URL}`);
      }

      if (loadGeneration === cacheGeneration) {
        // DEV-only: prepend a seeded hash from localStorage.__dev_fakeCamera so
        // preview_eval fake camera injection produces a reliable recognition match.
        if (import.meta.env.DEV) {
          try {
            const raw = localStorage.getItem('__dev_fakeCamera');
            if (raw) {
              interface ClipSeed {
                concertId?: number;
                hash?: string;
              }
              const cfg = JSON.parse(raw) as ClipSeed & { clips?: ClipSeed[] };
              // Support both single-clip { concertId, hash } and multi-clip { clips: [...] }
              const seeds: ClipSeed[] = Array.isArray(cfg.clips) ? cfg.clips : [cfg];
              for (const seed of seeds) {
                if (seed.hash && seed.concertId != null) {
                  const entry = payload.entries.find((e) => e.concertId === seed.concertId);
                  if (entry) {
                    entry.phash = [seed.hash, ...entry.phash.filter((h) => h !== seed.hash)];
                    console.info(
                      `[dev] recognition hash seeded for concertId=${seed.concertId} from localStorage.__dev_fakeCamera`
                    );
                  }
                }
              }
            }
          } catch {
            // Never break recognition if DEV test code fails
          }
        }
        cachedEntries = payload.entries;
      }

      return payload.entries;
    })
    .finally(() => {
      if (loadGeneration === cacheGeneration) {
        inFlightLoad = null;
      }
    });

  return inFlightLoad;
}

export function preloadRecognitionIndex(): void {
  void getRecognitionIndexEntries().catch((error) => {
    const resolvedError =
      error instanceof Error ? error : new Error('Failed to preload recognition index');
    console.warn('[recognition-index] Preload skipped:', resolvedError.message);
  });
}

export function clearRecognitionIndexCache(): void {
  cacheGeneration += 1;
  cachedEntries = null;
  inFlightLoad = null;
}
