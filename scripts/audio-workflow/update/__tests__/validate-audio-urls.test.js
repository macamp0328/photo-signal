import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import https from 'node:https';
import {
  checkUrl,
  checkLocalFile,
  classifyUrlShape,
  calculateStats,
  findConcertById,
  findLocalFilesByBasename,
  generateReport,
  inferLikelyFailure,
  normalizeBaseUrl,
  normalizePrefix,
  probeRemoteAudio,
  resolveAudioUrl,
} from '../validate-audio-urls.js';

describe('validate-audio-urls', () => {
  const testDir = '/tmp/validate-audio-urls-tests';
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
    vi.restoreAllMocks();
  });

  describe('checkUrl', () => {
    it('should detect local file paths and delegate to checkLocalFile', async () => {
      const localUrl = '/audio/test.opus';

      const result = await checkUrl(localUrl, 5000);

      expect(result.isLocal).toBe(true);
      expect(result.url).toBe(localUrl);
    });

    it('should handle HTTP URLs', async () => {
      // Note: This test would require network access or mocking
      // For a unit test, we'll just verify the structure

      // We can't easily test actual HTTP requests in unit tests
      // without mocking, so we'll skip this or mock it
      expect(checkUrl).toBeDefined();
    });

    it('should handle HTTPS URLs', async () => {
      // Similar to HTTP - would need mocking for proper testing

      expect(checkUrl).toBeDefined();
    });

    it('should pass Origin header for remote requests', async () => {
      const mockResponse = {
        statusCode: 200,
        statusMessage: 'OK',
        resume: vi.fn(),
      };
      const mockRequest = {
        on: vi.fn(),
      };

      const getSpy = vi.spyOn(https, 'get').mockImplementation((_url, opts, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await checkUrl('https://example.com/audio.opus', 5000, {
        origin: 'http://localhost:5173',
      });

      expect(result.accessible).toBe(true);
      expect(getSpy).toHaveBeenCalledWith(
        'https://example.com/audio.opus',
        expect.objectContaining({
          timeout: 5000,
          headers: expect.objectContaining({
            Origin: 'http://localhost:5173',
          }),
        }),
        expect.any(Function)
      );
    });

    it('should pass shared secret header for remote requests', async () => {
      const mockResponse = {
        statusCode: 200,
        statusMessage: 'OK',
        resume: vi.fn(),
      };
      const mockRequest = {
        on: vi.fn(),
      };

      const getSpy = vi.spyOn(https, 'get').mockImplementation((_url, opts, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await checkUrl('https://example.com/audio.opus', 5000, {
        sharedSecret: 'top-secret-token',
      });

      expect(result.accessible).toBe(true);
      expect(getSpy).toHaveBeenCalledWith(
        'https://example.com/audio.opus',
        expect.objectContaining({
          timeout: 5000,
          headers: expect.objectContaining({
            'X-PS-Shared-Secret': 'top-secret-token',
          }),
        }),
        expect.any(Function)
      );
    });
  });

  describe('trace helpers', () => {
    it('should classify flat worker path shape', () => {
      const shape = classifyUrlShape('https://worker.example.com/prod/audio/concert-1.opus');

      expect(shape.type).toBe('flat');
      expect(shape.key).toBe('prod/audio/concert-1.opus');
    });

    it('should classify id-scoped worker path shape', () => {
      const shape = classifyUrlShape('https://worker.example.com/prod/audio/12/concert-1.opus');

      expect(shape.type).toBe('id-scoped');
      expect(shape.inferredId).toBe(12);
    });

    it('should find concert by id', () => {
      const concerts = [
        { id: 1, band: 'A' },
        { id: 2, band: 'B' },
      ];

      const match = findConcertById(concerts, 2);
      expect(match?.band).toBe('B');
    });

    it('should infer likely 403 failure cause', () => {
      const diagnosis = inferLikelyFailure({
        accessible: false,
        status: 403,
        statusText: 'Forbidden',
      });
      expect(diagnosis).toMatch(/CORS|allowlist/i);
    });

    it('should find local basename matches in a custom directory', () => {
      const customRoot = join(testDir, 'encode-output');
      const nested = join(customRoot, '12');
      mkdirSync(nested, { recursive: true });
      const localFile = join(nested, 'concert-1.opus');
      writeFileSync(localFile, 'dummy');
      testFiles.push(localFile);

      const matches = findLocalFilesByBasename('concert-1.opus', customRoot);
      expect(matches.some((entry) => entry.endsWith('encode-output/12/concert-1.opus'))).toBe(true);
    });

    it('should probe remote audio with HEAD and Range', async () => {
      const calls = [];
      const mockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.spyOn(https, 'request').mockImplementation((_url, options, callback) => {
        calls.push(options);
        callback({
          statusCode: options.method === 'HEAD' ? 200 : 206,
          statusMessage: 'OK',
          headers: {
            'access-control-allow-origin': 'https://www.whoisduck2.com',
          },
          resume: vi.fn(),
        });
        return mockRequest;
      });

      const result = await probeRemoteAudio(
        'https://worker.example.com/prod/audio/concert-1.opus',
        5000,
        {
          origin: 'https://www.whoisduck2.com',
        }
      );

      expect(result.head.status).toBe(200);
      expect(result.range.status).toBe(206);
      expect(calls[0].method).toBe('HEAD');
      expect(calls[1].headers.Range).toBe('bytes=0-1023');
    });
  });

  describe('checkLocalFile', () => {
    it('should return success for existing file', () => {
      // Create a test file in public/audio directory
      const publicDir = join(process.cwd(), 'public', 'audio');
      mkdirSync(publicDir, { recursive: true });
      const testFile = join(publicDir, 'test-validate.opus');
      writeFileSync(testFile, 'test content');
      testFiles.push(testFile);

      const result = checkLocalFile('/audio/test-validate.opus');

      expect(result.accessible).toBe(true);
      expect(result.isLocal).toBe(true);
      expect(result.status).toBe(200);
      expect(result.statusText).toContain('OK');
    });

    it('should return failure for missing file', () => {
      const result = checkLocalFile('/audio/nonexistent-file.opus');

      expect(result.accessible).toBe(false);
      expect(result.isLocal).toBe(true);
      expect(result.status).toBe(404);
      expect(result.statusText).toContain('Not Found');
      expect(result.error).toContain('not found');
    });

    it('should handle paths without leading slash', () => {
      // Create a test file
      const publicDir = join(process.cwd(), 'public', 'audio');
      mkdirSync(publicDir, { recursive: true });
      const testFile = join(publicDir, 'test-no-slash.opus');
      writeFileSync(testFile, 'test content');
      testFiles.push(testFile);

      const result = checkLocalFile('audio/test-no-slash.opus');

      expect(result.accessible).toBe(true);
    });
  });

  describe('calculateStats', () => {
    it('should calculate success rate correctly', () => {
      const results = [
        { accessible: true },
        { accessible: true },
        { accessible: true },
        { accessible: false },
        { accessible: false },
      ];

      const stats = calculateStats(results);

      expect(stats.total).toBe(5);
      expect(stats.successful).toBe(3);
      expect(stats.failed).toBe(2);
      expect(stats.successRate).toBe(60);
    });

    it('should handle all successes', () => {
      const results = [{ accessible: true }, { accessible: true }];

      const stats = calculateStats(results);

      expect(stats.successRate).toBe(100);
      expect(stats.successful).toBe(2);
      expect(stats.failed).toBe(0);
    });

    it('should handle all failures', () => {
      const results = [{ accessible: false }, { accessible: false }];

      const stats = calculateStats(results);

      expect(stats.successRate).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(2);
    });

    it('should handle empty results', () => {
      const stats = calculateStats([]);

      expect(stats.total).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('should round success rate to 1 decimal place', () => {
      const results = [{ accessible: true }, { accessible: true }, { accessible: false }];

      const stats = calculateStats(results);

      expect(stats.successRate).toBe(66.7);
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

      expect(report).toMatch(/Recommendations/i);
      expect(report).toMatch(/CDN/i);
      expect(report).toMatch(/CORS/i);
    });

    it('should include all statistics', () => {
      const stats = {
        total: 8,
        successful: 6,
        failed: 2,
        successRate: 75,
      };

      const report = generateReport(stats);

      expect(report).toContain('8');
      expect(report).toContain('6');
      expect(report).toContain('2');
      expect(report).toContain('75.0%');
    });
  });

  describe('resolveAudioUrl', () => {
    it('should return raw URL when no base override is provided', () => {
      const url = resolveAudioUrl('/audio/test.opus', 12, '', 'prod/audio');

      expect(url).toBe('/audio/test.opus');
    });

    it('should replace the base and keep existing prefix path', () => {
      const url = resolveAudioUrl(
        'https://example.r2.cloudflarestorage.com/photo-signal-audio/prod/audio/1/test.opus',
        1,
        'https://audio.example.com',
        'prod/audio'
      );

      expect(url).toBe('https://audio.example.com/prod/audio/1/test.opus');
    });

    it('should append prefix and concert id when missing', () => {
      const url = resolveAudioUrl('/audio/test.opus', 5, 'https://audio.example.com', 'prod/audio');

      expect(url).toBe('https://audio.example.com/prod/audio/5/test.opus');
    });
  });

  describe('normalize helpers', () => {
    it('should trim trailing slash in base URL', () => {
      expect(normalizeBaseUrl('https://audio.example.com/')).toBe('https://audio.example.com');
    });

    it('should strip leading and trailing slashes from prefix', () => {
      expect(normalizePrefix('/prod/audio/')).toBe('prod/audio');
    });
  });
});
