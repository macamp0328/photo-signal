import type { Concert } from '../../types';

/**
 * Check if a concert has any photo hashes (legacy or new format)
 * Note: This only validates existence and type, not hash format/length.
 * The legacy photoHash field may contain hashes in either format (16 or 32 chars).
 */
function hasAnyPhotoHashes(concert: Concert): boolean {
  const legacy = concert.photoHash;
  if (typeof legacy === 'string' && legacy.length > 0) {
    return true;
  }
  if (Array.isArray(legacy) && legacy.length > 0) {
    return legacy.every((hash) => typeof hash === 'string' && hash.length > 0);
  }

  const { photoHashes } = concert;
  if (photoHashes) {
    const algorithmKeys: Array<'dhash' | 'phash'> = ['dhash', 'phash'];
    return algorithmKeys.some((algorithm) => {
      const values = photoHashes[algorithm];
      return (
        Array.isArray(values) &&
        values.length > 0 &&
        values.every((hash) => typeof hash === 'string' && hash.length > 0)
      );
    });
  }

  return false;
}

/**
 * Data Service
 *
 * Manages concert data loading and caching.
 * Currently loads from static JSON, designed for easy PostgreSQL migration.
 * Supports switching between production and test data sources.
 */
class DataService {
  private cache: Concert[] | null = null;
  private isTestMode = false;
  private readonly productionDataUrl = '/data.json';
  private readonly developmentDataUrl = '/assets/test-data/concerts.dev.json';
  private readonly testDataUrl = this.developmentDataUrl;
  private listeners: Array<() => void> = [];

  /**
   * Set test mode - switches data source between production and test data
   * Clears cache to force reload with new data source
   */
  setTestMode(enabled: boolean): void {
    if (this.isTestMode !== enabled) {
      console.log(`[DataService] Test mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
      console.log(
        `[DataService] Data will be loaded from: ${enabled ? this.testDataUrl : this.productionDataUrl}`
      );
      this.isTestMode = enabled;
      this.clearCache();
      this.notifyListeners();
    }
  }

  /**
   * Get current data mode
   */
  getTestMode(): boolean {
    return this.isTestMode;
  }

  /**
   * Subscribe to data source changes
   * Returns an unsubscribe function
   */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of data source change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
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

  /**
   * Get all concerts
   * Cached after first call for performance
   */
  async getConcerts(): Promise<Concert[]> {
    if (this.cache) {
      return this.cache as Concert[];
    }

    try {
      const dataSource = this.getActiveDataSource();
      const dataUrl = this.getDataUrl();
      console.log(`[DataService] Loading concert data from: ${dataUrl}`);
      console.log(`[DataService] Data source: ${dataSource}`);
      console.log(`[DataService] Test mode: ${this.isTestMode ? 'ENABLED' : 'DISABLED'}`);

      const response = await fetch(dataUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const concerts = Array.isArray(data.concerts) ? data.concerts : [];
      this.cache = concerts;

      const concertsWithHashes = concerts.filter((c: Concert) => hasAnyPhotoHashes(c)).length;

      console.log(`[DataService] Successfully loaded ${concerts.length} concerts`);
      console.log(`[DataService] Concerts with photo hashes: ${concertsWithHashes}`);

      if (concerts.length === 0) {
        console.warn('[DataService] Warning: No concerts found in data file');
      }

      if (concertsWithHashes === 0) {
        console.warn(
          '[DataService] Warning: No concerts have photoHash values. Photo recognition will not work.'
        );
      }

      return concerts;
    } catch (error) {
      console.error('[DataService] Failed to load concert data:', error);
      console.error(`[DataService] Attempted to load from: ${this.getDataUrl()}`);
      console.error(
        `[DataService] Test mode is ${this.isTestMode ? 'ENABLED' : 'DISABLED'}. Try ${this.isTestMode ? 'disabling' : 'enabling'} it in Secret Settings.`
      );
      return [];
    }
  }

  /**
   * Get concert by ID
   */
  getConcertById(id: number): Concert | null {
    if (!this.cache) return null;
    return this.cache.find((concert) => concert.id === id) || null;
  }

  /**
   * Search concerts by band, venue, or date
   * Simple text search - can be enhanced with fuzzy matching
   */
  search(query: string): Concert[] {
    if (!this.cache) return [];

    const lowerQuery = query.toLowerCase();
    return this.cache.filter(
      (concert) =>
        concert.band.toLowerCase().includes(lowerQuery) ||
        concert.venue.toLowerCase().includes(lowerQuery) ||
        concert.date.includes(lowerQuery)
    );
  }

  /**
   * Clear cache (useful for development/testing)
   */
  clearCache(): void {
    this.cache = null;
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
