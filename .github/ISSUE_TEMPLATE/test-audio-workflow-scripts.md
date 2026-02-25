---
name: Add Tests for Audio Workflow Scripts
about: Add comprehensive tests for production audio workflow scripts (download, encode, update) to ensure reliability
title: 'test(scripts): add tests for audio workflow scripts'
labels: ['testing', 'audio-workflow', 'scripts', 'ai-agent-ready']
assignees: ''
---

## Problem Statement

The audio workflow scripts in `scripts/audio-workflow/` handle critical production operations (downloading tracks, encoding audio, migrating to CDN) but currently lack automated tests. These scripts process audio files, update data files, and interact with external services. Without tests, bugs could corrupt audio files, break data.json, or fail silently.

**Current State:**

- ❌ **No tests** for `download-yt-song.js` (complex, downloads from YouTube)
- ❌ **No tests** for `encode-audio.js` (complex, normalizes/encodes audio)
- ❌ **No tests** for `migrate-audio-to-cdn.js` (updates data.json structure)
- ❌ **No tests** for `validate-audio-urls.js` (validates URL accessibility)
- ✅ **Well documented** - Each script has detailed README
- ✅ **Production critical** - Used for real audio pipeline

**Risk Areas:**

1. **Data Corruption** - Malformed JSON could break the app
2. **File Loss** - Download failures could lose track metadata
3. **Silent Failures** - Encoding errors might go unnoticed
4. **Broken URLs** - Migration could create inaccessible audio
5. **Configuration Errors** - Invalid config could cause crashes

**Why These Scripts Need Testing:**

Unlike one-time helper scripts (create-test-images.js, generate-favicons.html), these are **production tools** that:

- Run repeatedly in the audio production workflow
- Modify critical runtime data files (data.app.v2.json, data.recognition.v2.json)
- Process expensive assets (downloaded audio files)
- Require external dependencies (ffmpeg, yt-dlp)
- Have complex error handling and retry logic

---

## Proposed Solution

Add focused unit tests for critical functions in each script. Use Node.js test runner (Vitest) with mocked external dependencies (filesystem, network, child processes).

### Test Coverage Goals

**High Priority (Must Test):**

1. **`download-yt-song.js`**:
   - Argument parsing
   - Config file loading
   - Output path resolution
   - Metadata index creation
   - Error handling (missing dependencies, download failures)

2. **`encode-audio.js`**:
   - Config loading and validation
   - Metadata extraction
   - Filename generation (concert naming)
   - Manifest creation (audio-index.json, photo-audio-map.json)
   - LUFS calculation parsing
   - Error handling (missing ffmpeg, corrupt files)

3. **`migrate-audio-to-cdn.js`**:
   - data.json parsing and updating
   - CDN URL generation (GitHub releases, R2)
   - Backup creation
   - Dry-run mode
   - Validation (no data loss)

4. **`validate-audio-urls.js`**:
   - URL accessibility checking
   - Local file validation
   - Timeout handling
   - Success rate calculation
   - Report generation

**Low Priority (Optional):**

- Integration tests with real ffmpeg/yt-dlp (too slow for CI)
- End-to-end workflow tests (download → encode → migrate)
- Performance benchmarks

---

## Implementation Plan

### Phase 1: Create Test Infrastructure

**Directory Structure:**

```
scripts/audio-workflow/
├── download/
│   ├── download-yt-song.js
│   └── __tests__/
│       └── download-yt-song.test.js
├── encode/
│   ├── encode-audio.js
│   └── __tests__/
│       └── encode-audio.test.js
└── update/
    ├── migrate-audio-to-cdn.js
    ├── validate-audio-urls.js
    └── __tests__/
        ├── migrate-audio-to-cdn.test.js
        └── validate-audio-urls.test.js
```

**Files to Create:**

1. `scripts/audio-workflow/download/__tests__/download-yt-song.test.js`
2. `scripts/audio-workflow/encode/__tests__/encode-audio.test.js`
3. `scripts/audio-workflow/update/__tests__/migrate-audio-to-cdn.test.js`
4. `scripts/audio-workflow/update/__tests__/validate-audio-urls.test.js`

**Test Runner Configuration:**

Add to `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    include: [
      'src/**/*.test.{ts,tsx}',
      'scripts/**/__tests__/**/*.test.{js,ts}', // NEW: Include script tests
    ],
    // ... rest of config
  },
});
```

---

### Phase 2: Refactor Scripts for Testability

**Goal**: Extract testable functions from scripts without changing behavior.

**Pattern**: Export internal functions for testing while keeping CLI interface unchanged.

**Example (encode-audio.js):**

```javascript
// Before (untestable)
async function main() {
  const config = loadConfig(configPath);
  const downloads = findDownloads(inputDir);
  // ... 500 lines of code
}

main().catch(console.error);

// After (testable)
export function loadConfig(configPath) {
  // Config loading logic
}

export function findDownloads(inputDir) {
  // Download discovery logic
}

export function generateOutputFilename(metadata, config) {
  // Filename generation logic
}

// CLI entry point (unchanged behavior)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
```

**Functions to Extract:**

**download-yt-song.js:**

- `parseArgs(argv)` - Parse command line arguments
- `loadConfig(configPath)` - Load and merge configuration
- `resolvePath(path)` - Resolve relative paths
- `normalizePlaylistSelection(item)` - Parse playlist item selection
- `parseFormatPreference(formatOrder)` - Parse format priority list
- `createMetadataIndex(trackInfo, options)` - Create metadata JSON

**encode-audio.js:**

- `loadConfig(configPath)` - Load encode configuration
- `findDownloads(inputDir)` - Find .metadata.json files
- `generateOutputFilename(metadata, config)` - Generate ps-YYYYMMDD-artist-venue.opus
- `parseLUFS(ffmpegOutput)` - Extract LUFS from ffmpeg output
- `createAudioIndex(results)` - Generate audio-index.json
- `createPhotoAudioMap(results)` - Generate photo-audio-map.json

**migrate-audio-to-cdn.js:**

- `loadDataJson(dataPath)` - Load and parse data.json
- `generateCdnUrl(audioFile, baseUrl, provider)` - Generate CDN URL
- `updateConcert(concert, baseUrl, provider)` - Update concert object
- `createBackup(dataPath)` - Create timestamped backup
- `validateMigration(original, updated)` - Ensure no data loss

**validate-audio-urls.js:**

- `loadDataJson(dataPath)` - Load and parse data.json
- `checkUrl(url, timeout)` - Check URL accessibility (with timeout)
- `checkLocalFile(path)` - Check local file existence
- `calculateStats(results)` - Calculate success rate
- `generateReport(stats)` - Generate validation report

---

### Phase 3: Write Tests for migrate-audio-to-cdn.js

**File**: `scripts/audio-workflow/update/__tests__/migrate-audio-to-cdn.test.js`

**Priority**: Highest (modifies critical data.json file)

**Test Cases:**

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadDataJson,
  generateCdnUrl,
  updateConcert,
  createBackup,
  validateMigration,
} from '../migrate-audio-to-cdn.js';

describe('migrate-audio-to-cdn', () => {
  describe('loadDataJson', () => {
    it('should load and parse valid data.json', () => {
      const testData = {
        concerts: [{ id: 1, audioFile: '/audio/test.opus' }],
      };
      const tempFile = '/tmp/test-data.json';
      writeFileSync(tempFile, JSON.stringify(testData));

      const result = loadDataJson(tempFile);

      expect(result).toEqual(testData);
      expect(result.concerts).toHaveLength(1);
    });

    it('should throw error for missing file', () => {
      expect(() => loadDataJson('/nonexistent/data.json')).toThrow();
    });

    it('should throw error for malformed JSON', () => {
      const tempFile = '/tmp/bad-data.json';
      writeFileSync(tempFile, 'invalid json {]');

      expect(() => loadDataJson(tempFile)).toThrow();
    });

    it('should throw error for invalid schema (no concerts array)', () => {
      const testData = { notConcerts: [] };
      const tempFile = '/tmp/invalid-schema.json';
      writeFileSync(tempFile, JSON.stringify(testData));

      expect(() => loadDataJson(tempFile)).toThrow(/concerts/i);
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
      ).toThrow(/provider/i);
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

    it('should handle already-migrated concerts (skip)', () => {
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
      const originalPath = '/tmp/test-data.json';
      const testData = { concerts: [] };
      writeFileSync(originalPath, JSON.stringify(testData));

      const backupPath = createBackup(originalPath);

      expect(existsSync(backupPath)).toBe(true);
      expect(backupPath).toContain('data.backup');
      expect(backupPath).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/); // Timestamp format
    });

    it('should preserve original file content in backup', () => {
      const originalPath = '/tmp/test-data.json';
      const testData = { concerts: [{ id: 1 }] };
      writeFileSync(originalPath, JSON.stringify(testData, null, 2));

      const backupPath = createBackup(originalPath);
      const backupContent = readFileSync(backupPath, 'utf-8');

      expect(JSON.parse(backupContent)).toEqual(testData);
    });

    it('should throw error if original file does not exist', () => {
      expect(() => createBackup('/nonexistent/file.json')).toThrow();
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

      expect(() => validateMigration(original, updated)).toThrow(/concert count/i);
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

      expect(() => validateMigration(original, updated)).toThrow(/field/i);
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
  });
});
```

---

### Phase 4: Write Tests for validate-audio-urls.js

**File**: `scripts/audio-workflow/update/__tests__/validate-audio-urls.test.js`

**Priority**: High (validates production data integrity)

**Test Cases:**

```javascript
import { describe, it, expect, vi } from 'vitest';
import {
  checkUrl,
  checkLocalFile,
  calculateStats,
  generateReport,
} from '../validate-audio-urls.js';

describe('validate-audio-urls', () => {
  describe('checkUrl', () => {
    it('should return success for accessible HTTP URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await checkUrl('https://example.com/audio.opus', 5000);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
    });

    it('should return failure for 404 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await checkUrl('https://example.com/missing.opus', 5000);

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it('should handle timeout', async () => {
      global.fetch = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10000)));

      const result = await checkUrl('https://slow.example.com/audio.opus', 100);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timeout/i);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const result = await checkUrl('https://broken.example.com/audio.opus', 5000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network failure');
    });
  });

  describe('checkLocalFile', () => {
    it('should return success for existing file', () => {
      // Mock file system
      vi.mock('node:fs', () => ({
        existsSync: vi.fn(() => true),
        statSync: vi.fn(() => ({ size: 1024 })),
      }));

      const result = checkLocalFile('/audio/test.opus');

      expect(result.success).toBe(true);
      expect(result.type).toBe('local');
    });

    it('should return failure for missing file', () => {
      vi.mock('node:fs', () => ({
        existsSync: vi.fn(() => false),
      }));

      const result = checkLocalFile('/audio/missing.opus');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('should handle file system errors', () => {
      vi.mock('node:fs', () => ({
        existsSync: vi.fn(() => {
          throw new Error('Permission denied');
        }),
      }));

      const result = checkLocalFile('/forbidden/audio.opus');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('calculateStats', () => {
    it('should calculate success rate correctly', () => {
      const results = [
        { success: true },
        { success: true },
        { success: true },
        { success: false },
        { success: false },
      ];

      const stats = calculateStats(results);

      expect(stats.total).toBe(5);
      expect(stats.successful).toBe(3);
      expect(stats.failed).toBe(2);
      expect(stats.successRate).toBe(60);
    });

    it('should handle all successes', () => {
      const results = [{ success: true }, { success: true }];

      const stats = calculateStats(results);

      expect(stats.successRate).toBe(100);
    });

    it('should handle all failures', () => {
      const results = [{ success: false }, { success: false }];

      const stats = calculateStats(results);

      expect(stats.successRate).toBe(0);
    });

    it('should handle empty results', () => {
      const stats = calculateStats([]);

      expect(stats.total).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('generateReport', () => {
    it('should generate success report', () => {
      const stats = {
        total: 10,
        successful: 10,
        failed: 0,
        successRate: 100,
      };

      const report = generateReport(stats);

      expect(report).toContain('100.0%');
      expect(report).toContain('✅');
      expect(report).toContain('All audio URLs are accessible');
    });

    it('should generate failure report', () => {
      const stats = {
        total: 10,
        successful: 7,
        failed: 3,
        successRate: 70,
      };

      const report = generateReport(stats);

      expect(report).toContain('70.0%');
      expect(report).toContain('⚠️');
      expect(report).toContain('3');
    });

    it('should include recommendations for failures', () => {
      const stats = {
        total: 5,
        successful: 2,
        failed: 3,
        successRate: 40,
      };

      const report = generateReport(stats);

      expect(report).toMatch(/check|verify|troubleshoot/i);
    });
  });
});
```

---

### Phase 5: Write Tests for encode-audio.js Functions

**File**: `scripts/audio-workflow/encode/__tests__/encode-audio.test.js`

**Priority**: High (processes expensive audio assets)

**Focus on Pure Functions** (filename generation, LUFS parsing, manifest creation):

```javascript
import { describe, it, expect } from 'vitest';
import {
  generateOutputFilename,
  parseLUFS,
  createAudioIndex,
  createPhotoAudioMap,
} from '../encode-audio.js';

describe('encode-audio', () => {
  describe('generateOutputFilename', () => {
    it('should generate filename with date-artist-venue format', () => {
      const metadata = {
        date: '2023-08-15',
        band: 'The Midnight Echoes',
        venue: 'The Fillmore',
      };

      const result = generateOutputFilename(metadata);

      expect(result).toBe('ps-20230815-the-midnight-echoes-the-fillmore.opus');
    });

    it('should normalize spaces to hyphens', () => {
      const metadata = {
        date: '2023-01-01',
        band: 'Electric Dreams',
        venue: 'Red Rocks Amphitheatre',
      };

      const result = generateOutputFilename(metadata);

      expect(result).toBe('ps-20230101-electric-dreams-red-rocks-amphitheatre.opus');
      expect(result).not.toContain(' ');
    });

    it('should lowercase the filename', () => {
      const metadata = {
        date: '2023-05-20',
        band: 'LOUD BAND',
        venue: 'BIG VENUE',
      };

      const result = generateOutputFilename(metadata);

      expect(result).toBe('ps-20230520-loud-band-big-venue.opus');
    });

    it('should remove special characters', () => {
      const metadata = {
        date: '2023-03-10',
        band: "The Band's Name!",
        venue: 'Venue @#$% Place',
      };

      const result = generateOutputFilename(metadata);

      expect(result).toMatch(/^ps-\d{8}-[\w-]+-[\w-]+\.opus$/);
      expect(result).not.toMatch(/[!@#$%']/);
    });

    it('should handle missing date gracefully', () => {
      const metadata = {
        band: 'Test Band',
        venue: 'Test Venue',
      };

      const result = generateOutputFilename(metadata);

      expect(result).toMatch(/^ps-\d{8}-test-band-test-venue\.opus$/);
    });
  });

  describe('parseLUFS', () => {
    it('should extract LUFS from ffmpeg output', () => {
      const ffmpegOutput = `
        [Parsed_ebur128_0 @ 0x7f8] t: 5.0    M: -14.2 S: -15.1    I: -14.0 LUFS     LRA:   7.5 LU
      `;

      const result = parseLUFS(ffmpegOutput);

      expect(result.integrated).toBe(-14.0);
      expect(result.momentary).toBe(-14.2);
      expect(result.lra).toBe(7.5);
    });

    it('should handle multi-line output', () => {
      const ffmpegOutput = `
        Input #0, wav, from 'input.wav':
        Duration: 00:03:45.00
        [Parsed_ebur128_0 @ 0x7f8] Summary:
        Integrated loudness:
        I:         -16.5 LUFS
        LRA:         9.2 LU
      `;

      const result = parseLUFS(ffmpegOutput);

      expect(result.integrated).toBe(-16.5);
      expect(result.lra).toBe(9.2);
    });

    it('should return null for invalid output', () => {
      const ffmpegOutput = 'Invalid output with no LUFS data';

      const result = parseLUFS(ffmpegOutput);

      expect(result).toBeNull();
    });
  });

  describe('createAudioIndex', () => {
    it('should create valid audio index JSON', () => {
      const results = [
        {
          fileName: 'ps-20230815-band-a-venue-a.opus',
          metadata: { band: 'Band A', venue: 'Venue A', date: '2023-08-15' },
          lufs: { integrated: -14.0, lra: 8.5 },
          duration: 185.3,
          checksum: 'abc123',
        },
        {
          fileName: 'ps-20230920-band-b-venue-b.opus',
          metadata: { band: 'Band B', venue: 'Venue B', date: '2023-09-20' },
          lufs: { integrated: -13.5, lra: 7.2 },
          duration: 210.7,
          checksum: 'def456',
        },
      ];

      const index = createAudioIndex(results);

      expect(index.tracks).toHaveLength(2);
      expect(index.tracks[0].file).toBe('ps-20230815-band-a-venue-a.opus');
      expect(index.tracks[0].lufs).toBe(-14.0);
      expect(index.tracks[0].lra).toBe(8.5);
      expect(index.tracks[0].duration).toBe(185.3);
      expect(index.tracks[0].checksum).toBe('abc123');
    });

    it('should include generation timestamp', () => {
      const results = [];
      const index = createAudioIndex(results);

      expect(index).toHaveProperty('generatedAt');
      expect(new Date(index.generatedAt)).toBeInstanceOf(Date);
    });

    it('should handle empty results', () => {
      const index = createAudioIndex([]);

      expect(index.tracks).toEqual([]);
    });
  });

  describe('createPhotoAudioMap', () => {
    it('should create placeholder mapping structure', () => {
      const results = [{ fileName: 'ps-20230815-band-venue.opus' }];

      const map = createPhotoAudioMap(results);

      expect(map).toHaveProperty('mappings');
      expect(Array.isArray(map.mappings)).toBe(true);
    });

    it('should include note about manual mapping', () => {
      const map = createPhotoAudioMap([]);

      expect(map).toHaveProperty('note');
      expect(map.note).toMatch(/manual/i);
    });
  });
});
```

---

### Phase 6: Write Tests for download-yt-song.js Functions

**File**: `scripts/audio-workflow/download/__tests__/download-yt-song.test.js`

**Priority**: Medium (complex but less critical than encode/migrate)

**Focus on Argument Parsing and Config Loading:**

```javascript
import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  loadConfig,
  normalizePlaylistSelection,
  parseFormatPreference,
} from '../download-yt-song.js';

describe('download-yt-song', () => {
  describe('parseArgs', () => {
    it('should parse item flag', () => {
      const argv = ['--item', '5'];
      const args = parseArgs(argv);

      expect(args.item).toBe(5);
    });

    it('should parse playlist-url flag', () => {
      const argv = ['--playlist-url', 'https://music.youtube.com/playlist?list=ABC'];
      const args = parseArgs(argv);

      expect(args['playlist-url']).toBe('https://music.youtube.com/playlist?list=ABC');
    });

    it('should parse boolean flags', () => {
      const argv = ['--dry-run', '--no-metadata'];
      const args = parseArgs(argv);

      expect(args['dry-run']).toBe(true);
      expect(args['no-metadata']).toBe(true);
    });

    it('should handle multiple format order', () => {
      const argv = ['--format-order', 'opus,mp3,wav'];
      const args = parseArgs(argv);

      expect(args['format-order']).toBe('opus,mp3,wav');
    });
  });

  describe('loadConfig', () => {
    it('should load valid config file', () => {
      // Would need to mock fs.readFileSync
      // Test structure for when refactored
    });

    it('should merge CLI args over config file', () => {
      // Test that CLI flags take precedence
    });

    it('should handle missing config file gracefully', () => {
      // Should use defaults, not crash
    });
  });

  describe('normalizePlaylistSelection', () => {
    it('should parse numeric item', () => {
      expect(normalizePlaylistSelection('5')).toBe('5');
      expect(normalizePlaylistSelection(5)).toBe('5');
    });

    it('should parse "all" keyword', () => {
      expect(normalizePlaylistSelection('all')).toBe('1-');
    });

    it('should parse range', () => {
      expect(normalizePlaylistSelection('1-10')).toBe('1-10');
    });

    it('should default to first item', () => {
      expect(normalizePlaylistSelection(null)).toBe('1');
      expect(normalizePlaylistSelection(undefined)).toBe('1');
    });
  });

  describe('parseFormatPreference', () => {
    it('should parse comma-separated formats', () => {
      const result = parseFormatPreference('opus,mp3,wav');

      expect(result).toEqual(['opus', 'mp3', 'wav']);
    });

    it('should trim whitespace', () => {
      const result = parseFormatPreference('opus , mp3 , wav');

      expect(result).toEqual(['opus', 'mp3', 'wav']);
    });

    it('should use default for null input', () => {
      const result = parseFormatPreference(null);

      expect(result).toEqual(['opus', 'mp3']);
    });

    it('should handle single format', () => {
      const result = parseFormatPreference('opus');

      expect(result).toEqual(['opus']);
    });
  });
});
```

---

### Phase 7: Update vitest.config.ts

**File**: `vitest.config.ts`

**Changes:**

```typescript
export default defineConfig({
  test: {
    include: [
      'src/**/*.test.{ts,tsx}',
      'scripts/**/__tests__/**/*.test.{js,ts}', // NEW: Include script tests
    ],
    // ... rest unchanged
  },
});
```

---

### Phase 8: Update Documentation

**Files to Update:**

1. `TESTING.md` - Add script test coverage section
2. `scripts/audio-workflow/README.md` - Document testing
3. `DOCUMENTATION_INDEX.md` - No changes needed (no new files)

**TESTING.md Addition:**

````markdown
### Script Test Coverage

Scripts in `scripts/audio-workflow/` have unit tests for critical functions:

| Script               | Tests | Status  | Focus Areas                      |
| -------------------- | ----- | ------- | -------------------------------- |
| migrate-audio-to-cdn | 15+   | ✅ Pass | data.json updates, validation    |
| validate-audio-urls  | 10+   | ✅ Pass | URL checking, stats calculation  |
| encode-audio         | 12+   | ✅ Pass | Filename generation, manifest    |
| download-yt-song     | 8+    | ✅ Pass | Argument parsing, config loading |

**Running Script Tests:**

```bash
npm run test:run -- scripts/
```
````

```

---

## Acceptance Criteria

- [ ] All 4 test files created in correct locations
- [ ] Functions extracted from scripts for testability (exported for testing)
- [ ] CLI behavior unchanged (scripts still work the same)
- [ ] Tests pass: `npm run test:run -- scripts/` exits with code 0
- [ ] Coverage >70% for tested functions
- [ ] Tests cover critical edge cases:
  - Missing files
  - Malformed JSON
  - Network failures
  - Invalid configurations
  - Divide-by-zero scenarios
- [ ] Mock external dependencies (fs, fetch, child_process)
- [ ] No actual ffmpeg/yt-dlp execution in tests (too slow)
- [ ] vitest.config.ts updated to include script tests
- [ ] TESTING.md updated with script test coverage
- [ ] All quality checks pass:
  - `npm run lint:fix`
  - `npm run format`
  - `npm run type-check`
  - `npm run test:run`

---

## Code Quality Requirements

- [ ] **Testable Code**: Functions extracted without changing behavior
- [ ] **Mock External Calls**: Use `vi.mock()` for fs, fetch, spawn
- [ ] **Fast Tests**: Each test <100ms (no real I/O)
- [ ] **Isolated Tests**: No shared state between tests
- [ ] **ESLint Pass**: `npm run lint` passes
- [ ] **Type Safety**: Use proper types (no `any`)
- [ ] **Clean Output**: Zero console warnings

---

## Testing Checklist

### Manual Verification

- [ ] Scripts still work: `npm run migrate-audio -- --help`
- [ ] Scripts still work: `npm run validate-audio -- --help`
- [ ] Tests run: `npm run test:run -- scripts/`
- [ ] Tests are fast: All tests complete in <5 seconds

### Edge Cases Covered

**migrate-audio-to-cdn.js:**
- [ ] Missing data.json file
- [ ] Malformed JSON
- [ ] Invalid schema (no concerts array)
- [ ] Already-migrated concerts (skip)
- [ ] Backup creation
- [ ] Validation (no data loss)

**validate-audio-urls.js:**
- [ ] HTTP 200, 404, 500 responses
- [ ] Network timeouts
- [ ] Local file checks
- [ ] Mixed success/failure rates
- [ ] Empty results

**encode-audio.js:**
- [ ] Filename normalization
- [ ] Special character handling
- [ ] LUFS parsing from ffmpeg output
- [ ] Manifest generation
- [ ] Empty results

**download-yt-song.js:**
- [ ] Argument parsing
- [ ] Config file loading
- [ ] Format preference parsing
- [ ] Playlist selection normalization

---

## Future Enhancements

- [ ] Add integration tests with real ffmpeg/yt-dlp (separate from CI)
- [ ] Add end-to-end workflow tests (download → encode → migrate)
- [ ] Add performance benchmarks for large playlists
- [ ] Add snapshot tests for manifest files
- [ ] Add tests for error recovery and retry logic

---

## References

- **Audio Workflow README**: `scripts/audio-workflow/README.md`
- **Encode README**: `scripts/audio-workflow/encode/README.md`
- **Download README**: `scripts/audio-workflow/download/README.md`
- **Existing Tests**: `src/modules/*/`
- **Vitest Docs**: https://vitest.dev/

---

## AI Agent Guidelines

This issue is **AI agent-ready** and follows the project's testing standards.

### Refactoring Strategy

1. **Read the script** to understand its structure
2. **Identify pure functions** (no I/O, just logic)
3. **Extract functions** by adding `export` keyword
4. **Keep CLI unchanged** by checking `if (import.meta.url === \`file://\${process.argv[1]}\`)`
5. **Write tests** for extracted functions
6. **Mock I/O** (fs, fetch, spawn) with `vi.mock()`

### Testing Workflow

1. Create `__tests__/` directory in same folder as script
2. Create `<script-name>.test.js` file
3. Import functions from script: `import { func } from '../script.js'`
4. Write tests using `describe/it/expect`
5. Mock external dependencies: `vi.mock('node:fs')`
6. Run tests: `npm run test:run -- scripts/`

### Commit Messages

```

refactor(scripts): extract testable functions from migrate-audio-to-cdn
test(scripts): add tests for migrate-audio-to-cdn data updates
refactor(scripts): extract testable functions from encode-audio
test(scripts): add tests for encode-audio filename generation
docs(testing): update TESTING.md with script test coverage

```

---

**Last Updated**: 2025-11-21
```
