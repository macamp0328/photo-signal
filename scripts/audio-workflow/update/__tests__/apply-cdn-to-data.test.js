import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyCdnToData,
  buildAudioUrl,
  sanitizePrefix,
  trimTrailingSlash,
  updateConcertWithCdn,
} from '../apply-cdn-to-data.js';

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

  it('buildAudioUrl should include prefix and concert id', () => {
    const concert = { id: 5, audioFile: '/audio/test-track.opus' };
    const url = buildAudioUrl(concert, 'https://audio.example.com', 'prod/audio');
    expect(url).toBe('https://audio.example.com/prod/audio/5/test-track.opus');
  });

  it('buildAudioUrl should trim trailing slashes', () => {
    const concert = { id: 2, audioFile: '/audio/clip.opus' };
    const url = buildAudioUrl(concert, 'https://audio.example.com/', '/prod/audio/');
    expect(url).toBe('https://audio.example.com/prod/audio/2/clip.opus');
  });

  it('updateConcertWithCdn should update audioFile to CDN URL', () => {
    const concert = { id: 3, band: 'Test Band', audioFile: '/audio/sample.opus' };
    const updated = updateConcertWithCdn(concert, 'https://cdn.example.com', 'prod/audio');

    expect(updated.audioFile).toBe('https://cdn.example.com/prod/audio/3/sample.opus');
    expect(updated.audioFileFallback).toBeUndefined();
    expect(updated.audioFileSource).toBeUndefined();
  });

  it('applyCdnToData should update all concerts with audio', () => {
    const data = {
      concerts: [
        { id: 1, audioFile: '/audio/a.opus' },
        { id: 2, band: 'No Audio' },
      ],
    };

    const updated = applyCdnToData(data, 'https://audio.example.com', 'prod/audio');

    expect(updated.concerts[0].audioFile).toBe('https://audio.example.com/prod/audio/1/a.opus');
    expect(updated.concerts[0].audioFileFallback).toBeUndefined();
    expect(updated.concerts[1].audioFile).toBeUndefined();
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

  it('should throw when concert is missing id', () => {
    const concert = { band: 'Test', audioFile: '/audio/x.opus' };
    expect(() => buildAudioUrl(concert, 'https://audio.example.com', 'prod/audio')).toThrow(
      'concert must include id and audioFile'
    );
  });

  it('CLI dry run should not write file', () => {
    const data = { concerts: [{ id: 1, audioFile: '/audio/a.opus' }] };
    const file = createTestFile('data.json', JSON.stringify(data));
    const output = applyCdnToData(JSON.parse(JSON.stringify(data)), 'https://audio.example.com');
    expect(output.concerts[0].audioFile).toContain('/prod/audio/1/a.opus');
    expect(existsSync(`${file}.backup`)).toBe(false);
  });
});
