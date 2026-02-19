/**
 * Unit tests for the two pure module-level helpers in usePhotoRecognition:
 *
 *   findBestMatches — selects best and second-best pHash candidates from a
 *                     flat concert hash list.
 *
 *   buildDebugInfo  — constructs a RecognitionDebugInfo snapshot from the
 *                     per-frame pipeline values; no side-effects.
 *
 * Both functions are stateless and require no React or DOM setup.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Concert } from '../../../types';
import type { FrameQualityInfo, StabilityDebugInfo } from '../types';
import { createEmptyTelemetry } from '../helpers';
import { buildDebugInfo, findBestMatches, type BuildDebugInfoArgs } from '../usePhotoRecognition';

// ---------------------------------------------------------------------------
// Mock hammingDistance so each test can specify exact distances without
// needing real pHash strings that produce known Hamming differences.
// ---------------------------------------------------------------------------
vi.mock('../algorithms/hamming', () => ({
  hammingDistance: vi.fn(),
}));

import { hammingDistance } from '../algorithms/hamming';
const mockHD = vi.mocked(hammingDistance);

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
const makeConcert = (id: number): Concert => ({
  id,
  band: `Band ${id}`,
  venue: `Venue ${id}`,
  date: '2023-01-01T00:00:00-05:00',
  audioFile: `/audio/${id}.opus`,
});

// ---------------------------------------------------------------------------
// findBestMatches
// ---------------------------------------------------------------------------
describe('findBestMatches', () => {
  beforeEach(() => {
    mockHD.mockReset();
  });

  it('returns null for both when the list is empty', () => {
    const { bestMatch, secondBestMatch } = findBestMatches('abc', []);
    expect(bestMatch).toBeNull();
    expect(secondBestMatch).toBeNull();
  });

  it('returns the sole entry as bestMatch with null secondBestMatch', () => {
    const concert = makeConcert(1);
    mockHD.mockReturnValue(10);

    const { bestMatch, secondBestMatch } = findBestMatches('hash', [{ hash: 'h1', concert }]);

    expect(bestMatch).toEqual({ concert, distance: 10 });
    expect(secondBestMatch).toBeNull();
  });

  it('selects the minimum-distance entry as bestMatch', () => {
    const [a, b, c] = [makeConcert(1), makeConcert(2), makeConcert(3)];
    mockHD
      .mockReturnValueOnce(20) // a
      .mockReturnValueOnce(5) // b — new best
      .mockReturnValueOnce(15); // c — beats a, becomes second-best

    const { bestMatch, secondBestMatch } = findBestMatches('hash', [
      { hash: 'hA', concert: a },
      { hash: 'hB', concert: b },
      { hash: 'hC', concert: c },
    ]);

    expect(bestMatch).toEqual({ concert: b, distance: 5 });
    expect(secondBestMatch).toEqual({ concert: c, distance: 15 });
  });

  it('updates second-best as a new best repeatedly displaces previous bests', () => {
    const [a, b, c] = [makeConcert(1), makeConcert(2), makeConcert(3)];
    mockHD
      .mockReturnValueOnce(20) // a — initial best
      .mockReturnValueOnce(10) // b — new best; a becomes second
      .mockReturnValueOnce(3); // c — new best; b becomes second

    const { bestMatch, secondBestMatch } = findBestMatches('hash', [
      { hash: 'hA', concert: a },
      { hash: 'hB', concert: b },
      { hash: 'hC', concert: c },
    ]);

    expect(bestMatch).toEqual({ concert: c, distance: 3 });
    expect(secondBestMatch).toEqual({ concert: b, distance: 10 });
  });

  it('does not place an exact tie with bestMatch into secondBestMatch', () => {
    // Two concerts with identical distance — no clear second-best signal.
    const [a, b] = [makeConcert(1), makeConcert(2)];
    mockHD.mockReturnValueOnce(8).mockReturnValueOnce(8);

    const { bestMatch, secondBestMatch } = findBestMatches('hash', [
      { hash: 'hA', concert: a },
      { hash: 'hB', concert: b },
    ]);

    expect(bestMatch).toEqual({ concert: a, distance: 8 });
    expect(secondBestMatch).toBeNull();
  });

  it('correctly identifies best and second-best from a larger list', () => {
    const distances = [15, 30, 7, 20, 12];
    const entries = distances.map((_, i) => ({ hash: `h${i}`, concert: makeConcert(i + 1) }));
    distances.forEach((d) => mockHD.mockReturnValueOnce(d));

    const { bestMatch, secondBestMatch } = findBestMatches('hash', entries);

    expect(bestMatch?.distance).toBe(7);
    expect(secondBestMatch?.distance).toBe(12);
  });

  it('preserves concert reference equality in results', () => {
    const concert = makeConcert(99);
    mockHD.mockReturnValue(0);

    const { bestMatch } = findBestMatches('hash', [{ hash: 'h', concert }]);
    expect(bestMatch?.concert).toBe(concert);
  });

  it('allows the same concert to appear as both best and second-best via different hashes', () => {
    // A single concert with multiple pHash variants; closer variant wins best.
    const concert = makeConcert(1);
    mockHD.mockReturnValueOnce(3).mockReturnValueOnce(9);

    const { bestMatch, secondBestMatch } = findBestMatches('hash', [
      { hash: 'h1', concert },
      { hash: 'h2', concert },
    ]);

    expect(bestMatch).toEqual({ concert, distance: 3 });
    expect(secondBestMatch).toEqual({ concert, distance: 9 });
  });

  it('passes the current hash string to hammingDistance for every entry', () => {
    const [a, b] = [makeConcert(1), makeConcert(2)];
    mockHD.mockReturnValue(5);

    findBestMatches('frame-hash-xyz', [
      { hash: 'hA', concert: a },
      { hash: 'hB', concert: b },
    ]);

    expect(mockHD).toHaveBeenCalledWith('frame-hash-xyz', 'hA');
    expect(mockHD).toHaveBeenCalledWith('frame-hash-xyz', 'hB');
    expect(mockHD).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// buildDebugInfo
// ---------------------------------------------------------------------------
describe('buildDebugInfo', () => {
  const concertA = makeConcert(1);
  const concertB = makeConcert(2);

  /** Minimal valid args; override individual fields per test. */
  const baseArgs = (): BuildDebugInfoArgs => ({
    currentHash: 'abc1234567890def',
    bestMatch: null,
    secondBestMatch: null,
    bestMargin: null,
    now: 1_700_000_000_000,
    concertCount: 5,
    frameCount: 42,
    checkInterval: 180,
    aspectRatio: '3:2',
    framedRegion: { width: 640, height: 480 },
    stability: null,
    similarityThreshold: 12,
    recognitionDelay: 300,
    frameQuality: null,
    telemetry: createEmptyTelemetry(),
  });

  it('always sets hashAlgorithm to "phash"', () => {
    expect(buildDebugInfo(baseArgs()).hashAlgorithm).toBe('phash');
  });

  it('maps null bestMatch to null output', () => {
    expect(buildDebugInfo(baseArgs()).bestMatch).toBeNull();
  });

  it('maps null secondBestMatch to null output', () => {
    expect(buildDebugInfo(baseArgs()).secondBestMatch).toBeNull();
  });

  it('builds a BestMatchInfo from a bestMatch MatchCandidate', () => {
    const info = buildDebugInfo({
      ...baseArgs(),
      bestMatch: { concert: concertA, distance: 12 },
    });

    expect(info.bestMatch).toMatchObject({
      concert: concertA,
      distance: 12,
      algorithm: 'phash',
    });
    expect(typeof info.bestMatch?.similarity).toBe('number');
  });

  it('computes similarity as ((64 - distance) / 64) * 100', () => {
    const distance = 12;
    const info = buildDebugInfo({
      ...baseArgs(),
      bestMatch: { concert: concertA, distance },
    });

    const expected = ((64 - distance) / 64) * 100; // 81.25
    expect(info.bestMatch?.similarity).toBeCloseTo(expected);
  });

  it('computes similarity for distance 0 as 100', () => {
    const info = buildDebugInfo({
      ...baseArgs(),
      bestMatch: { concert: concertA, distance: 0 },
    });
    expect(info.bestMatch?.similarity).toBeCloseTo(100);
  });

  it('builds a BestMatchInfo from a secondBestMatch MatchCandidate', () => {
    const info = buildDebugInfo({
      ...baseArgs(),
      bestMatch: { concert: concertA, distance: 5 },
      secondBestMatch: { concert: concertB, distance: 20 },
    });

    expect(info.secondBestMatch).toMatchObject({
      concert: concertB,
      distance: 20,
      algorithm: 'phash',
    });
    expect(typeof info.secondBestMatch?.similarity).toBe('number');
  });

  it('passes stability: null through unchanged', () => {
    expect(buildDebugInfo({ ...baseArgs(), stability: null }).stability).toBeNull();
  });

  it('passes a StabilityDebugInfo object through by reference', () => {
    const stability: StabilityDebugInfo = {
      concert: concertA,
      elapsedMs: 150,
      remainingMs: 150,
      requiredMs: 300,
      progress: 0.5,
    };
    expect(buildDebugInfo({ ...baseArgs(), stability }).stability).toBe(stability);
  });

  it('maps framedRegion width/height to frameSize', () => {
    const info = buildDebugInfo({
      ...baseArgs(),
      framedRegion: { width: 320, height: 240 },
    });
    expect(info.frameSize).toEqual({ width: 320, height: 240 });
  });

  it('passes frameQuality: null through unchanged', () => {
    expect(buildDebugInfo({ ...baseArgs(), frameQuality: null }).frameQuality).toBeNull();
  });

  it('passes a FrameQualityInfo object through by reference', () => {
    const frameQuality: FrameQualityInfo = {
      sharpness: 150,
      isSharp: true,
      glarePercentage: 5,
      hasGlare: false,
      averageBrightness: 120,
      hasPoorLighting: false,
      lightingType: 'ok',
    };
    expect(buildDebugInfo({ ...baseArgs(), frameQuality }).frameQuality).toBe(frameQuality);
  });

  it('copies all scalar fields from args to the output', () => {
    const args: BuildDebugInfoArgs = {
      ...baseArgs(),
      currentHash: 'deadbeef12345678',
      bestMargin: 8,
      now: 9_999_999,
      concertCount: 13,
      frameCount: 77,
      checkInterval: 50,
      aspectRatio: '2:3',
      similarityThreshold: 10,
      recognitionDelay: 500,
    };
    const info = buildDebugInfo(args);

    expect(info.lastFrameHash).toBe('deadbeef12345678');
    expect(info.bestMatchMargin).toBe(8);
    expect(info.lastCheckTime).toBe(9_999_999);
    expect(info.concertCount).toBe(13);
    expect(info.frameCount).toBe(77);
    expect(info.checkInterval).toBe(50);
    expect(info.aspectRatio).toBe('2:3');
    expect(info.similarityThreshold).toBe(10);
    expect(info.recognitionDelay).toBe(500);
  });

  it('stores the telemetry reference passed in (caller owns spreading)', () => {
    const telemetry = createEmptyTelemetry();
    telemetry.totalFrames = 100;
    telemetry.successfulRecognitions = 3;

    const info = buildDebugInfo({ ...baseArgs(), telemetry });

    expect(info.telemetry).toBe(telemetry);
    expect(info.telemetry.totalFrames).toBe(100);
    expect(info.telemetry.successfulRecognitions).toBe(3);
  });
});
