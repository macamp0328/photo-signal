import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadDataJson,
  generateCdnUrl,
  updateConcert,
  createBackup,
  validateMigration,
} from '../migrate-audio-to-cdn.js';

describe('migrate-audio-to-cdn', () => {
  const testDir = '/tmp/migrate-audio-cdn-tests';
  let testFiles = [];

  beforeEach(() => {
    // Create test directory
    mkdirSync(testDir, { recursive: true });
    testFiles = [];
  });

  afterEach(() => {
    // Clean up test files
    for (const file of testFiles) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  const createTestFile = (filename, content) => {
    const filepath = join(testDir, filename);
    writeFileSync(filepath, typeof content === 'string' ? content : JSON.stringify(content));
    testFiles.push(filepath);
    return filepath;
  };

  describe('loadDataJson', () => {
    it('should load and parse valid data.json', () => {
      const testData = {
        concerts: [{ id: 1, audioFile: '/audio/test.opus' }],
      };
      const tempFile = createTestFile('data.json', testData);

      const result = loadDataJson(tempFile);

      expect(result).toEqual(testData);
      expect(result.concerts).toHaveLength(1);
    });

    it('should throw error for missing file', () => {
      expect(() => loadDataJson('/nonexistent/data.json')).toThrow('Source file not found');
    });

    it('should throw error for malformed JSON', () => {
      const tempFile = createTestFile('bad-data.json', 'invalid json {]');

      expect(() => loadDataJson(tempFile)).toThrow('Invalid JSON');
    });

    it('should throw error for invalid schema (no concerts array)', () => {
      const testData = { notConcerts: [] };
      const tempFile = createTestFile('invalid-schema.json', testData);

      expect(() => loadDataJson(tempFile)).toThrow('missing concerts array');
    });

    it('should throw error for concerts not being an array', () => {
      const testData = { concerts: 'not-an-array' };
      const tempFile = createTestFile('invalid-concerts.json', testData);

      expect(() => loadDataJson(tempFile)).toThrow('missing concerts array');
    });
  });

  describe('generateCdnUrl', () => {
    it('should generate GitHub Releases URL', () => {
      const baseUrl = 'https://github.com/user/repo/releases/download/audio-v1';
      const audioFile = '/audio/concert-1.opus';

      const result = generateCdnUrl(audioFile, baseUrl, 'github-release');

      expect(result).toBe('https://github.com/user/repo/releases/download/audio-v1/concert-1.opus');
    });

    it('should generate Cloudflare R2 URL', () => {
      const baseUrl = 'https://audio.example.com';
      const audioFile = '/audio/concert-2.opus';

      const result = generateCdnUrl(audioFile, baseUrl, 'r2');

      expect(result).toBe('https://audio.example.com/concert-2.opus');
    });

    it('should handle trailing slashes in base URL', () => {
      const baseUrl = 'https://cdn.example.com/audio/';
      const audioFile = '/audio/test.opus';

      const result = generateCdnUrl(audioFile, baseUrl, 'r2');

      expect(result).toBe('https://cdn.example.com/audio/test.opus');
      expect(result).not.toContain('//test.opus');
    });

    it('should preserve original filename', () => {
      const baseUrl = 'https://cdn.example.com';
      const audioFile = '/audio/ps-20230815-the-midnight-echoes.opus';

      const result = generateCdnUrl(audioFile, baseUrl, 'r2');

      expect(result).toContain('ps-20230815-the-midnight-echoes.opus');
    });

    it('should throw error for invalid provider', () => {
      expect(() =>
        generateCdnUrl('/audio/test.opus', 'https://cdn.com', 'invalid-provider')
      ).toThrow('Invalid CDN provider');
    });

    it('should handle relative paths', () => {
      const baseUrl = 'https://cdn.example.com';
      const audioFile = 'audio/concert.opus';

      const result = generateCdnUrl(audioFile, baseUrl, 'github-release');

      expect(result).toBe('https://cdn.example.com/concert.opus');
    });
  });

  describe('updateConcert', () => {
    it('should add CDN URL and preserve fallback', () => {
      const concert = {
        id: 1,
        band: 'Test Band',
        audioFile: '/audio/test.opus',
      };
      const baseUrl = 'https://cdn.example.com';

      const updated = updateConcert(concert, baseUrl, 'r2');

      expect(updated.audioFile).toBe('https://cdn.example.com/test.opus');
      expect(updated.audioFileFallback).toBe('/audio/test.opus');
      expect(updated.audioFileSource).toBe('r2');
    });

    it('should not modify concerts without audioFile', () => {
      const concert = {
        id: 1,
        band: 'Test Band',
      };

      const updated = updateConcert(concert, 'https://cdn.com', 'r2');

      expect(updated).toEqual(concert);
      expect(updated).not.toHaveProperty('audioFileFallback');
    });

    it('should preserve all original concert fields', () => {
      const concert = {
        id: 1,
        band: 'Test Band',
        venue: 'Test Venue',
        date: '2023-01-01',
        audioFile: '/audio/test.opus',
        customField: 'custom value',
      };

      const updated = updateConcert(concert, 'https://cdn.com', 'r2');

      expect(updated.band).toBe('Test Band');
      expect(updated.venue).toBe('Test Venue');
      expect(updated.date).toBe('2023-01-01');
      expect(updated.customField).toBe('custom value');
    });

    it('should handle already-migrated concerts (HTTP)', () => {
      const concert = {
        id: 1,
        audioFile: 'http://cdn.example.com/test.opus',
        audioFileFallback: '/audio/test.opus',
        audioFileSource: 'r2',
      };

      const updated = updateConcert(concert, 'https://cdn.example.com', 'r2');

      expect(updated).toEqual(concert);
    });

    it('should handle already-migrated concerts (HTTPS)', () => {
      const concert = {
        id: 1,
        audioFile: 'https://cdn.example.com/test.opus',
        audioFileFallback: '/audio/test.opus',
        audioFileSource: 'r2',
      };

      const updated = updateConcert(concert, 'https://cdn.example.com', 'r2');

      expect(updated).toEqual(concert);
    });
  });

  describe('createBackup', () => {
    it('should create timestamped backup file', () => {
      const originalPath = createTestFile('test-data.json', { concerts: [] });

      const backupPath = createBackup(originalPath);
      testFiles.push(backupPath);

      expect(existsSync(backupPath)).toBe(true);
      expect(backupPath).toContain('test-data.json.backup');
      expect(backupPath).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/); // Timestamp format
    });

    it('should preserve original file content in backup', () => {
      const testData = { concerts: [{ id: 1 }] };
      const originalPath = createTestFile('test-data.json', JSON.stringify(testData, null, 2));

      const backupPath = createBackup(originalPath);
      testFiles.push(backupPath);

      const backupContent = readFileSync(backupPath, 'utf-8');
      expect(JSON.parse(backupContent)).toEqual(testData);
    });

    it('should throw error if original file does not exist', () => {
      expect(() => createBackup('/nonexistent/file.json')).toThrow('file not found');
    });
  });

  describe('validateMigration', () => {
    it('should pass for valid migration', () => {
      const original = {
        concerts: [
          { id: 1, band: 'Band A', audioFile: '/audio/a.opus' },
          { id: 2, band: 'Band B', audioFile: '/audio/b.opus' },
        ],
      };

      const updated = {
        concerts: [
          {
            id: 1,
            band: 'Band A',
            audioFile: 'https://cdn.com/a.opus',
            audioFileFallback: '/audio/a.opus',
            audioFileSource: 'r2',
          },
          {
            id: 2,
            band: 'Band B',
            audioFile: 'https://cdn.com/b.opus',
            audioFileFallback: '/audio/b.opus',
            audioFileSource: 'r2',
          },
        ],
      };

      expect(() => validateMigration(original, updated)).not.toThrow();
    });

    it('should throw error if concert count changes', () => {
      const original = {
        concerts: [
          { id: 1, audioFile: '/audio/a.opus' },
          { id: 2, audioFile: '/audio/b.opus' },
        ],
      };

      const updated = {
        concerts: [{ id: 1, audioFile: 'https://cdn.com/a.opus' }],
      };

      expect(() => validateMigration(original, updated)).toThrow('Concert count mismatch');
    });

    it('should throw error if required fields are removed', () => {
      const original = {
        concerts: [{ id: 1, band: 'Band A', venue: 'Venue A', audioFile: '/audio/a.opus' }],
      };

      const updated = {
        concerts: [
          { id: 1, audioFile: 'https://cdn.com/a.opus' }, // Missing band and venue
        ],
      };

      expect(() => validateMigration(original, updated)).toThrow('Required field');
    });

    it('should allow adding new fields', () => {
      const original = {
        concerts: [{ id: 1, audioFile: '/audio/a.opus' }],
      };

      const updated = {
        concerts: [
          {
            id: 1,
            audioFile: 'https://cdn.com/a.opus',
            audioFileFallback: '/audio/a.opus',
            audioFileSource: 'r2',
          },
        ],
      };

      expect(() => validateMigration(original, updated)).not.toThrow();
    });

    it('should validate each concert individually', () => {
      const original = {
        concerts: [
          { id: 1, band: 'Band A', audioFile: '/audio/a.opus' },
          { id: 2, band: 'Band B', venue: 'Venue B', audioFile: '/audio/b.opus' },
        ],
      };

      const updated = {
        concerts: [
          { id: 1, band: 'Band A', audioFile: 'https://cdn.com/a.opus' },
          { id: 2, audioFile: 'https://cdn.com/b.opus' }, // Missing band and venue
        ],
      };

      expect(() => validateMigration(original, updated)).toThrow('Required field');
    });
  });
});
