import type { AppDataV2, Concert } from '../../types';

interface DataSourceTelemetry {
  v2LoadAttempts: number;
  v2LoadFailures: number;
}

/**
 * Check if a concert has pHash values.
 * Note: This only validates existence and type, not hash format/length.
 */
function hasAnyPhotoHashes(concert: Concert): boolean {
  const { photoHashes } = concert;
  if (!photoHashes) {
    return false;
  }

  const values = photoHashes.phash;
  return (
    Array.isArray(values) &&
    values.length > 0 &&
    values.every((hash) => typeof hash === 'string' && hash.length > 0)
  );
}

/**
 * Data Service
 *
 * Manages concert data loading and caching.
 * Currently loads from static JSON, designed for easy PostgreSQL migration.
 */
class DataService {
  private cache: Concert[] | null = null;
  private cacheById: Map<number, Concert> | null = null;
  private cacheByBand: Map<string, Concert[]> | null = null;
  private inFlightRequest: Promise<Concert[]> | null = null;
  private dataSourceTelemetry: DataSourceTelemetry = {
    v2LoadAttempts: 0,
    v2LoadFailures: 0,
  };
  private readonly productionDataUrl = '/data.app.v2.json';
  private readonly developmentDataUrl = this.productionDataUrl;

  /**
   * Get the current data URL based on runtime mode
   */
  private getDataUrl(): string {
    const dataSource = this.getActiveDataSource();
    if (dataSource === 'production') {
      return this.productionDataUrl;
    }
    return this.developmentDataUrl;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private normalizeV2Payload(data: AppDataV2): Concert[] {
    const artistsById = new Map(data.artists.map((artist) => [artist.id, artist]));
    const photosById = new Map(data.photos.map((photo) => [photo.id, photo]));
    const tracksById = new Map(data.tracks.map((track) => [track.id, track]));

    return data.entries.flatMap((entry) => {
      const artist = artistsById.get(entry.artistId);
      const track = tracksById.get(entry.trackId);

      if (!artist || !track) {
        return [];
      }

      const photo = entry.photoId ? photosById.get(entry.photoId) : undefined;

      return [
        {
          id: entry.id,
          band: artist.name,
          venue: entry.venue,
          date: entry.date,
          audioFile: track.audioFile,
          songTitle: track.songTitle,
          imageFile: photo?.imageFile,
          photoUrl: photo?.photoUrl,
          recognitionEnabled: entry.recognitionEnabled ?? photo?.recognitionEnabled,
          camera: photo?.camera,
          aperture: photo?.aperture,
          focalLength: photo?.focalLength,
          shutterSpeed: photo?.shutterSpeed,
          iso: photo?.iso,
          photoHashes: photo?.photoHashes,
          albumCoverUrl: track.albumCoverUrl,
        } satisfies Concert,
      ];
    });
  }

  private parseConcertsFromPayload(payload: unknown): Concert[] {
    if (!this.isObject(payload)) {
      return [];
    }

    const v2Payload = payload as Partial<AppDataV2>;
    if (
      v2Payload.version === 2 &&
      Array.isArray(v2Payload.artists) &&
      Array.isArray(v2Payload.photos) &&
      Array.isArray(v2Payload.tracks) &&
      Array.isArray(v2Payload.entries)
    ) {
      return this.normalizeV2Payload(v2Payload as AppDataV2);
    }

    return [];
  }

  private async fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private recordV2PrimaryAttempt(): void {
    this.dataSourceTelemetry.v2LoadAttempts += 1;
  }

  private recordV2PrimaryFailure(): void {
    this.dataSourceTelemetry.v2LoadFailures += 1;
  }

  private async fetchDataPayload(): Promise<{ payload: unknown; loadedFrom: string }> {
    const primaryDataUrl = this.getDataUrl();
    this.recordV2PrimaryAttempt();

    try {
      const payload = await this.fetchJson(primaryDataUrl);
      return { payload, loadedFrom: primaryDataUrl };
    } catch (primaryError) {
      this.recordV2PrimaryFailure();
      throw primaryError;
    }
  }

  private getActiveDataSource(): 'production' | 'development' {
    const mode = this.getRuntimeMode();
    if (mode === 'test' || mode === 'development') {
      return 'development';
    }

    return 'production';
  }

  private getRuntimeMode(): 'development' | 'test' | 'production' {
    try {
      const mode = import.meta.env.MODE;
      if (mode === 'test' || mode === 'development') {
        return mode;
      }
    } catch {
      // ignore and fall through
    }

    return 'production';
  }

  private rebuildLookups(concerts: Concert[]): void {
    const byId = new Map<number, Concert>();
    const byBand = new Map<string, Concert[]>();

    for (const concert of concerts) {
      byId.set(concert.id, concert);

      const existingBandConcerts = byBand.get(concert.band) ?? [];
      existingBandConcerts.push(concert);
      byBand.set(concert.band, existingBandConcerts);
    }

    this.cacheById = byId;
    this.cacheByBand = byBand;
  }

  /**
   * Get all concerts
   * Cached after first call for performance
   * Deduplicates concurrent in-flight requests
   */
  async getConcerts(): Promise<Concert[]> {
    if (this.cache) {
      return this.cache as Concert[];
    }

    // If a request is already in flight, return that promise to dedupe concurrent calls
    if (this.inFlightRequest) {
      return this.inFlightRequest;
    }

    // Create and store the in-flight request promise
    this.inFlightRequest = (async () => {
      try {
        const dataSource = this.getActiveDataSource();
        const dataUrl = this.getDataUrl();
        console.log(`[DataService] Loading concert data from: ${dataUrl}`);
        console.log(`[DataService] Data source: ${dataSource}`);

        const { payload, loadedFrom } = await this.fetchDataPayload();
        const concerts = this.parseConcertsFromPayload(payload);
        this.cache = concerts;
        this.rebuildLookups(concerts);

        const concertsWithHashes = concerts.filter((c: Concert) => hasAnyPhotoHashes(c)).length;

        console.log(`[DataService] Successfully loaded ${concerts.length} concerts`);
        console.log(`[DataService] Loaded payload source: ${loadedFrom}`);
        console.log(`[DataService] Concerts with photo hashes: ${concertsWithHashes}`);

        if (concerts.length === 0) {
          console.warn('[DataService] Warning: No concerts found in data file');
        }

        if (concertsWithHashes === 0) {
          console.warn(
            '[DataService] Warning: No concerts expose photoHashes. Photo recognition will not work.'
          );
        }

        return concerts;
      } catch (error) {
        console.error('[DataService] Failed to load concert data:', error);
        console.error(`[DataService] Attempted to load from: ${this.getDataUrl()}`);
        return [];
      } finally {
        // Clear the in-flight request after it completes (success or failure)
        this.inFlightRequest = null;
      }
    })();

    return this.inFlightRequest;
  }

  /**
   * Get all concerts for a given band name (exact match)
   */
  getConcertsByBand(band: string): Concert[] {
    if (!this.cacheByBand) return [];
    return this.cacheByBand.get(band) ?? [];
  }

  /**
   * Get concert by ID
   */
  getConcertById(id: number): Concert | null {
    if (!this.cacheById) return null;
    return this.cacheById.get(id) ?? null;
  }

  /**
   * Clear cache (useful for development/testing)
   */
  clearCache(): void {
    this.cache = null;
    this.cacheById = null;
    this.cacheByBand = null;
    this.inFlightRequest = null;
    this.dataSourceTelemetry = {
      v2LoadAttempts: 0,
      v2LoadFailures: 0,
    };
  }

  getDataSourceTelemetry(): DataSourceTelemetry {
    return { ...this.dataSourceTelemetry };
  }
}

// Export singleton instance
export const dataService = new DataService();
