import type { AppDataV2, Concert, ConcertData } from '../../types';
import { getTimestampSearchText } from '../../utils/dateUtils';

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
 * Test mode is retained as a feature flag but does not change the data source.
 */
class DataService {
  private cache: Concert[] | null = null;
  private cacheById: Map<number, Concert> | null = null;
  private cacheByBand: Map<string, Concert[]> | null = null;
  private inFlightRequest: Promise<Concert[]> | null = null;
  private isTestMode = false;
  private readonly productionDataUrl = '/data.app.v2.json';
  private readonly legacyDataUrl = '/data.json';
  private readonly developmentDataUrl = this.productionDataUrl;
  private readonly testDataUrl = this.developmentDataUrl;

  /**
   * Set test mode flag state.
   *
   * The flag is retained for compatibility with feature-flag flows,
   * but data loading remains pinned to a single URL.
   */
  setTestMode(enabled: boolean): void {
    if (this.isTestMode !== enabled) {
      console.log(`[DataService] Test mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
      console.log(
        `[DataService] Data will be loaded from: ${enabled ? this.testDataUrl : this.productionDataUrl}`
      );
      this.isTestMode = enabled;
    }
  }

  /**
   * Get current data mode
   */
  getTestMode(): boolean {
    return this.isTestMode;
  }

  /**
   * Get the current data URL based on test mode
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

    const legacyConcerts = (payload as Partial<ConcertData>).concerts;
    if (Array.isArray(legacyConcerts)) {
      return legacyConcerts as Concert[];
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

  private async fetchDataPayload(): Promise<{ payload: unknown; loadedFrom: string }> {
    const primaryDataUrl = this.getDataUrl();

    try {
      const payload = await this.fetchJson(primaryDataUrl);
      return { payload, loadedFrom: primaryDataUrl };
    } catch (primaryError) {
      if (primaryDataUrl === this.legacyDataUrl) {
        throw primaryError;
      }

      console.warn(
        `[DataService] Failed loading primary data (${primaryDataUrl}), falling back to ${this.legacyDataUrl}`,
        primaryError
      );

      const payload = await this.fetchJson(this.legacyDataUrl);
      return { payload, loadedFrom: this.legacyDataUrl };
    }
  }

  private getActiveDataSource(): 'production' | 'development' | 'test' {
    if (this.isTestMode) {
      return 'test';
    }

    const mode = this.getRuntimeMode();
    if (mode === 'test') {
      return 'test';
    }

    if (mode === 'development') {
      return 'development';
    }

    return 'production';
  }

  private getRuntimeMode(): 'development' | 'test' | 'production' {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
      const normalized = process.env.NODE_ENV.toLowerCase();
      if (normalized === 'test' || normalized === 'development') {
        return normalized;
      }
      return 'production';
    }

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
        console.log(`[DataService] Test mode: ${this.isTestMode ? 'ENABLED' : 'DISABLED'}`);

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
        console.error(`[DataService] Legacy fallback URL: ${this.legacyDataUrl}`);
        console.error(`[DataService] Test mode is ${this.isTestMode ? 'ENABLED' : 'DISABLED'}.`);
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
   * Search concerts by band, venue, or date
   * Simple text search - can be enhanced with fuzzy matching
   */
  search(query: string): Concert[] {
    if (!this.cache) return [];

    const lowerQuery = query.toLowerCase();
    return this.cache.filter((concert) => {
      const bandMatch = concert.band.toLowerCase().includes(lowerQuery);
      const venueMatch = concert.venue.toLowerCase().includes(lowerQuery);
      const rawDateMatch = concert.date.toLowerCase().includes(lowerQuery);
      const formattedDateMatch = getTimestampSearchText(concert.date).includes(lowerQuery);

      return bandMatch || venueMatch || rawDateMatch || formattedDateMatch;
    });
  }

  /**
   * Clear cache (useful for development/testing)
   */
  clearCache(): void {
    this.cache = null;
    this.cacheById = null;
    this.cacheByBand = null;
    this.inFlightRequest = null;
  }

  /**
   * Get random concert (for placeholder recognition)
   */
  getRandomConcert(): Concert | null {
    if (!this.cache || this.cache.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.cache.length);
    return this.cache[randomIndex];
  }
}

// Export singleton instance
export const dataService = new DataService();
