import type { Concert } from '../../types';

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
  private readonly testDataUrl = '/assets/test-data/concerts.json';

  /**
   * Set test mode - switches data source between production and test data
   * Clears cache to force reload with new data source
   */
  setTestMode(enabled: boolean): void {
    if (this.isTestMode !== enabled) {
      this.isTestMode = enabled;
      this.clearCache();
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
    return this.isTestMode ? this.testDataUrl : this.productionDataUrl;
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
      const dataUrl = this.getDataUrl();
      const response = await fetch(dataUrl);
      const data = await response.json();
      this.cache = data.concerts || [];
      return this.cache as Concert[];
    } catch (error) {
      console.error('Failed to load concert data:', error);
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
