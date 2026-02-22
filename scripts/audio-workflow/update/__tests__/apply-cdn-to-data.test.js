import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyCdnToData,
  buildAudioUrl,
  buildPhotoUrl,
  sanitizePrefix,
  trimTrailingSlash,
  updateConcertWithCdn,
} from '../apply-cdn-to-data.js';
import { loadProjectEnv } from '../load-local-env.js';

describe('apply-cdn-to-data', () => {
  const testDir = '/tmp/apply-cdn-tests';
  let testFiles = [];

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    testFiles = [];
  });

  afterEach(() => {
    for (const file of testFiles) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch {
        // ignore cleanup errors
      }
    }
  });

  const createTestFile = (filename, content) => {
    const filepath = join(testDir, filename);
    writeFileSync(filepath, content);
    testFiles.push(filepath);
    return filepath;
  };

  it('buildAudioUrl should include prefix and filename', () => {
    const concert = { id: 5, audioFile: '/audio/test-track.opus' };
    const url = buildAudioUrl(concert, 'https://audio.example.com', 'prod/audio');
    expect(url).toBe('https://audio.example.com/prod/audio/test-track.opus');
  });

  it('buildAudioUrl should trim trailing slashes', () => {
    const concert = { id: 2, audioFile: '/audio/clip.opus' };
    const url = buildAudioUrl(concert, 'https://audio.example.com/', '/prod/audio/');
    expect(url).toBe('https://audio.example.com/prod/audio/clip.opus');
  });

  it('updateConcertWithCdn should update audioFile to CDN URL', () => {
    const concert = {
      id: 3,
      band: 'Test Band',
      audioFile: '/audio/sample.opus',
      imageFile: '/assets/prod-photographs/sample.jpg',
    };
    const updated = updateConcertWithCdn(concert, 'https://cdn.example.com', 'prod/audio');

    expect(updated.audioFile).toBe('https://cdn.example.com/prod/audio/sample.opus');
    expect(updated.photoUrl).toBe('https://cdn.example.com/prod/photos/sample.jpg');
    expect(updated.audioFileFallback).toBeUndefined();
    expect(updated.audioFileSource).toBeUndefined();
  });

  it('buildPhotoUrl should include photo prefix and image filename', () => {
    const concert = { id: 8, imageFile: '/assets/prod-photographs/P3150376.jpg' };
    const url = buildPhotoUrl(concert, 'https://photo.example.com', 'prod/photos');
    expect(url).toBe('https://photo.example.com/prod/photos/P3150376.jpg');
  });

  it('applyCdnToData should update all concerts with audio', () => {
    const data = {
      concerts: [
        { id: 1, audioFile: '/audio/a.opus', imageFile: '/assets/prod-photographs/a.jpg' },
        { id: 2, band: 'No Audio' },
      ],
    };

    const updated = applyCdnToData(data, 'https://audio.example.com', 'prod/audio');

    expect(updated.concerts[0].audioFile).toBe('https://audio.example.com/prod/audio/a.opus');
    expect(updated.concerts[0].photoUrl).toBe('https://audio.example.com/prod/photos/a.jpg');
    expect(updated.concerts[0].audioFileFallback).toBeUndefined();
    expect(updated.concerts[1].audioFile).toBeUndefined();
  });

  it('updateConcertWithCdn should preserve existing photoUrl when imageFile is missing', () => {
    const concert = {
      id: 4,
      band: 'Legacy Photo URL',
      audioFile: '/audio/legacy.opus',
      photoUrl: 'https://legacy.example.com/prod/photos/legacy.jpg',
    };

    const updated = updateConcertWithCdn(concert, 'https://cdn.example.com', 'prod/audio');

    expect(updated.audioFile).toBe('https://cdn.example.com/prod/audio/legacy.opus');
    expect(updated.photoUrl).toBe('https://legacy.example.com/prod/photos/legacy.jpg');
  });

  it('sanitizePrefix should remove leading and trailing slashes', () => {
    expect(sanitizePrefix('/prod/audio/')).toBe('prod/audio');
  });

  it('trimTrailingSlash should remove trailing slash', () => {
    expect(trimTrailingSlash('https://audio.example.com/')).toBe('https://audio.example.com');
  });

  it('should throw when concerts array is missing', () => {
    expect(() => applyCdnToData({}, 'https://audio.example.com', 'prod/audio')).toThrow(
      'concerts array'
    );
  });

  it('should throw when concert is missing audioFile', () => {
    expect(() => buildAudioUrl({}, 'https://audio.example.com', 'prod/audio')).toThrow(
      'concert must include audioFile'
    );
  });

  it('CLI dry run should not write file', () => {
    const data = { concerts: [{ id: 1, audioFile: '/audio/a.opus' }] };
    const file = createTestFile('data.json', JSON.stringify(data));
    const output = applyCdnToData(JSON.parse(JSON.stringify(data)), 'https://audio.example.com');
    expect(output.concerts[0].audioFile).toContain('/prod/audio/a.opus');
    expect(existsSync(`${file}.backup`)).toBe(false);
  });

  it('loadProjectEnv should parse .env and .env.local edge cases without overriding existing vars', () => {
    const envPath = createTestFile(
      '.env',
      [
        '# comment',
        '',
        'PLAIN_KEY=plain-value',
        'EXPORT_KEY=from-env',
        'INVALID_LINE_WITHOUT_EQUALS',
        '=emptykey',
      ].join('\n')
    );

    const envLocalPath = createTestFile(
      '.env.local',
      [
        "export EXPORTED_KEY='from-export'",
        'QUOTED_DOUBLE="double value"',
        'INLINE_COMMENT=value # trailing comment removed',
        'EXPORT_KEY=from-env-local',
      ].join('\n')
    );

    const originalEnv = {
      PLAIN_KEY: process.env.PLAIN_KEY,
      EXPORT_KEY: process.env.EXPORT_KEY,
      EXPORTED_KEY: process.env.EXPORTED_KEY,
      QUOTED_DOUBLE: process.env.QUOTED_DOUBLE,
      INLINE_COMMENT: process.env.INLINE_COMMENT,
    };

    process.env.EXPORT_KEY = 'already-set';

    try {
      loadProjectEnv(testDir);

      expect(envPath).toContain('.env');
      expect(envLocalPath).toContain('.env.local');
      expect(process.env.PLAIN_KEY).toBe('plain-value');
      expect(process.env.EXPORT_KEY).toBe('already-set');
      expect(process.env.EXPORTED_KEY).toBe('from-export');
      expect(process.env.QUOTED_DOUBLE).toBe('double value');
      expect(process.env.INLINE_COMMENT).toBe('value');
      expect(process.env.INVALID_LINE_WITHOUT_EQUALS).toBeUndefined();
    } finally {
      if (originalEnv.PLAIN_KEY === undefined) delete process.env.PLAIN_KEY;
      else process.env.PLAIN_KEY = originalEnv.PLAIN_KEY;

      if (originalEnv.EXPORT_KEY === undefined) delete process.env.EXPORT_KEY;
      else process.env.EXPORT_KEY = originalEnv.EXPORT_KEY;

      if (originalEnv.EXPORTED_KEY === undefined) delete process.env.EXPORTED_KEY;
      else process.env.EXPORTED_KEY = originalEnv.EXPORTED_KEY;

      if (originalEnv.QUOTED_DOUBLE === undefined) delete process.env.QUOTED_DOUBLE;
      else process.env.QUOTED_DOUBLE = originalEnv.QUOTED_DOUBLE;

      if (originalEnv.INLINE_COMMENT === undefined) delete process.env.INLINE_COMMENT;
      else process.env.INLINE_COMMENT = originalEnv.INLINE_COMMENT;
    }
  });
});
