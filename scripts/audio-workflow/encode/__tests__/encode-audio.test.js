import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWriteStream, rmSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import {
  generateOutputFilename,
  parseLUFS,
  createAudioIndex,
  createPhotoAudioMap,
  selectBestThumbnailUrl,
  downloadAndResizeCover,
} from '../encode-audio.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  const mockCreateWriteStream = vi.fn();
  const mockRmSync = vi.fn();
  return {
    ...actual,
    createWriteStream: mockCreateWriteStream,
    rmSync: mockRmSync,
    default: {
      ...(actual.default ?? actual),
      createWriteStream: mockCreateWriteStream,
      rmSync: mockRmSync,
    },
  };
});

vi.mock('node:stream/promises', async (importOriginal) => {
  const actual = await importOriginal();
  const mockPipeline = vi.fn();
  return {
    ...actual,
    pipeline: mockPipeline,
    default: { ...(actual.default ?? actual), pipeline: mockPipeline },
  };
});

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  const mockSpawn = vi.fn();
  return {
    ...actual,
    spawn: mockSpawn,
    default: { ...(actual.default ?? actual), spawn: mockSpawn },
  };
});

/** Build a mock child process that emits 'close' or 'error' after the handler is registered. */
function makeMockProcess({ closeCode = 0, error = null } = {}) {
  return {
    on: vi.fn((event, cb) => {
      if (error && event === 'error') {
        Promise.resolve().then(() => cb(error));
      } else if (!error && event === 'close') {
        Promise.resolve().then(() => cb(closeCode));
      }
    }),
  };
}

describe('encode-audio', () => {
  describe('generateOutputFilename', () => {
    it('should generate filename with band-title-album format', () => {
      const result = generateOutputFilename(
        'The Midnight Echoes',
        'Live at The Fillmore',
        'City Lights'
      );

      expect(result).toBe('ps-the-midnight-echoes-city-lights-live-at-the-fillmore.opus');
    });

    it('should normalize spaces to hyphens', () => {
      const result = generateOutputFilename('Electric Dreams', 'Red Rocks Amphitheatre', 'My Song');

      expect(result).toBe('ps-electric-dreams-my-song-red-rocks-amphitheatre.opus');
      expect(result).not.toContain(' ');
    });

    it('should lowercase the filename', () => {
      const result = generateOutputFilename('LOUD BAND', 'BIG VENUE', 'LOUD TITLE');

      expect(result).toBe('ps-loud-band-loud-title-big-venue.opus');
    });

    it('should remove special characters', () => {
      const result = generateOutputFilename(
        "The Band's Name!",
        'Venue @#$% Place',
        'Hit Single!!!'
      );

      expect(result).toMatch(/^ps-[\w-]+-[\w-]+\.opus$/);
      expect(result).not.toMatch(/[!@#$%']/);
    });

    it('should handle ampersands by converting to "and"', () => {
      const result = generateOutputFilename(
        'Rock & Roll Band',
        'Blues & Jazz Festival',
        'Song & Dance'
      );

      // The actual implementation uses sanitize which converts & to "and"
      expect(result).not.toContain('&');
    });

    it('should handle multiple consecutive spaces', () => {
      const result = generateOutputFilename(
        'Band    With    Spaces',
        'Album  Title',
        'Track   Name'
      );

      expect(result).not.toContain('  ');
    });

    it('should handle leading/trailing spaces', () => {
      const result = generateOutputFilename('  Band Name  ', '  Album Name  ', '  Track Name  ');

      expect(result).toBe('ps-band-name-track-name-album-name.opus');
    });

    it('should handle multiple hyphens', () => {
      const result = generateOutputFilename('Band-Name', 'Album--Title', 'Song--Title');

      expect(result).not.toMatch(/--+/);
    });
  });

  describe('parseLUFS', () => {
    it('should extract LUFS from ffmpeg output with JSON', () => {
      const ffmpegOutput = `
        [Parsed_loudnorm_0 @ 0x7f8] 
        {
          "input_i": "-14.2",
          "input_tp": "-1.5",
          "input_lra": "7.5",
          "input_thresh": "-24.5",
          "output_i": "-14.0",
          "output_tp": "-1.0",
          "output_lra": "7.2",
          "output_thresh": "-24.0",
          "target_offset": "0.2"
        }
      `;

      const result = parseLUFS(ffmpegOutput);

      expect(result).toBeDefined();
      expect(result.input_i).toBe(-14.2);
      expect(result.input_tp).toBe(-1.5);
      expect(result.input_lra).toBe(7.5);
      expect(result.output_i).toBe(-14.0);
    });

    it('should handle multi-line output', () => {
      const ffmpegOutput = `
        Input #0, wav, from 'input.wav':
        Duration: 00:03:45.00
        [Parsed_loudnorm_0 @ 0x7f8] {
          "input_i": "-16.5",
          "input_tp": "-2.1",
          "input_lra": "9.2",
          "input_thresh": "-26.5",
          "output_i": "-16.0",
          "output_tp": "-2.0",
          "output_lra": "9.0",
          "output_thresh": "-26.0",
          "target_offset": "0.5"
        }
      `;

      const result = parseLUFS(ffmpegOutput);

      expect(result).toBeDefined();
      expect(result.input_i).toBe(-16.5);
      expect(result.input_lra).toBe(9.2);
    });

    it('should return null for invalid output', () => {
      const ffmpegOutput = 'Invalid output with no JSON data';

      const result = parseLUFS(ffmpegOutput);

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      const ffmpegOutput = 'Some output { invalid json {] }';

      const result = parseLUFS(ffmpegOutput);

      expect(result).toBeNull();
    });

    it('should coerce string numbers to actual numbers', () => {
      const ffmpegOutput = `{
        "input_i": "-14.2",
        "input_tp": "-1.5",
        "input_lra": "7.5"
      }`;

      const result = parseLUFS(ffmpegOutput);

      expect(typeof result.input_i).toBe('number');
      expect(typeof result.input_tp).toBe('number');
      expect(typeof result.input_lra).toBe('number');
    });
  });

  describe('createAudioIndex', () => {
    it('should create valid audio index JSON', () => {
      const results = [
        {
          success: true,
          dryRun: false,
          slug: 'band-a-venue-a',
          band: 'Band A',
          title: 'Track A',
          album: 'Venue A',
          date: '2023-08-15',
          releaseDate: '2023-08-15',
          genre: 'Rock',
          recordLabel: 'Label A',
          distributor: null,
          tags: ['rock', 'live'],
          categories: ['concert'],
          credits: { performer: 'Band A' },
          durationMs: 185300,
          bitrateKbps: 128,
          sourceBitrateKbps: 256,
          bitrateSource: 'metadata',
          lufsIntegrated: -14.0,
          truePeakDb: -1.5,
          lra: 8.5,
          outputFile: 'ps-band-a-venue-a.opus',
          checksum: 'abc123',
        },
      ];

      const config = {
        targetLUFS: -16,
        truePeakLimit: -1.0,
        opus: {
          bitrateKbps: 128,
          minBitrateFloorKbps: 96,
        },
      };

      const index = createAudioIndex(results, config);

      expect(index.schemaVersion).toBe(1);
      expect(index.tracks).toHaveLength(1);
      expect(index.tracks[0].id).toBe('band-a-venue-a');
      expect(index.tracks[0].band).toBe('Band A');
      expect(index.tracks[0].songTitle).toBe('Track A');
      expect(index.tracks[0].lufsIntegrated).toBe(-14.0);
      expect(index.tracks[0].lra).toBe(8.5);
      expect(index.tracks[0].durationMs).toBe(185300);
      expect(index.tracks[0].checksum).toBe('abc123');
      expect(index.config.targetLUFS).toBe(-16);
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

    it('should filter out failed results', () => {
      const results = [
        {
          success: true,
          dryRun: false,
          slug: 'success',
          band: 'Success Band',
          album: 'Album',
          date: '2023-01-01',
        },
        {
          success: false,
          dryRun: false,
          slug: 'failed',
          band: 'Failed Band',
          album: 'Album',
          date: '2023-01-02',
        },
      ];

      const index = createAudioIndex(results);

      expect(index.tracks).toHaveLength(1);
      expect(index.tracks[0].id).toBe('success');
    });

    it('should filter out dry-run results', () => {
      const results = [
        {
          success: true,
          dryRun: false,
          slug: 'real',
          band: 'Real Band',
          album: 'Album',
          date: '2023-01-01',
        },
        {
          success: true,
          dryRun: true,
          slug: 'dry',
          band: 'Dry Run Band',
          album: 'Album',
          date: '2023-01-02',
        },
      ];

      const index = createAudioIndex(results);

      expect(index.tracks).toHaveLength(1);
      expect(index.tracks[0].id).toBe('real');
    });

    it('should handle missing config gracefully', () => {
      const results = [
        {
          success: true,
          dryRun: false,
          slug: 'test',
          band: 'Test Band',
          album: 'Album',
          date: '2023-01-01',
        },
      ];

      const index = createAudioIndex(results);

      expect(index.config.targetLUFS).toBeNull();
      expect(index.config.opusBitrate).toBeNull();
    });
  });

  describe('createPhotoAudioMap', () => {
    it('should create placeholder mapping structure', () => {
      const results = [
        {
          success: true,
          dryRun: false,
          slug: 'band-venue',
          band: 'Test Band',
          album: 'Test Venue',
          date: '2023-08-15',
          releaseDate: '2023-08-15',
          genre: 'Rock',
          recordLabel: 'Label',
        },
      ];

      const map = createPhotoAudioMap(results);

      expect(map).toHaveProperty('mappings');
      expect(Array.isArray(map.mappings)).toBe(true);
      expect(map.mappings).toHaveLength(1);
      expect(map.mappings[0].audioId).toBe('band-venue');
      expect(map.mappings[0].photoId).toBeNull();
    });

    it('should include note about manual mapping', () => {
      const map = createPhotoAudioMap([]);

      expect(map).toHaveProperty('note');
      expect(map.note).toMatch(/manual|Photo ID mapping/i);
    });

    it('should include schema version', () => {
      const map = createPhotoAudioMap([]);

      expect(map.schemaVersion).toBe(1);
    });

    it('should include generation timestamp', () => {
      const map = createPhotoAudioMap([]);

      expect(map).toHaveProperty('generatedAt');
      expect(new Date(map.generatedAt)).toBeInstanceOf(Date);
    });

    it('should filter out failed and dry-run results', () => {
      const results = [
        {
          success: true,
          dryRun: false,
          slug: 'success',
          band: 'Band 1',
          album: 'Album 1',
          date: '2023-01-01',
        },
        {
          success: false,
          dryRun: false,
          slug: 'failed',
          band: 'Band 2',
          album: 'Album 2',
          date: '2023-01-02',
        },
        {
          success: true,
          dryRun: true,
          slug: 'dry',
          band: 'Band 3',
          album: 'Album 3',
          date: '2023-01-03',
        },
      ];

      const map = createPhotoAudioMap(results);

      expect(map.mappings).toHaveLength(1);
      expect(map.mappings[0].audioId).toBe('success');
    });
  });
});

describe('selectBestThumbnailUrl', () => {
  it('picks the thumbnail with the largest area', () => {
    const metadata = {
      track: {
        thumbnails: [
          { url: 'https://example.com/small.jpg', width: 100, height: 100 },
          { url: 'https://example.com/large.jpg', width: 500, height: 500 },
          { url: 'https://example.com/medium.jpg', width: 200, height: 200 },
        ],
      },
    };
    expect(selectBestThumbnailUrl(metadata)).toBe('https://example.com/large.jpg');
  });

  it('falls back to first entry with a URL when no dimensions are present', () => {
    const metadata = {
      track: {
        thumbnails: [
          { url: 'https://example.com/first.jpg' },
          { url: 'https://example.com/second.jpg' },
        ],
      },
    };
    expect(selectBestThumbnailUrl(metadata)).toBe('https://example.com/first.jpg');
  });

  it('skips thumbnail entries without a url', () => {
    const metadata = {
      track: {
        thumbnails: [
          { width: 500, height: 500 }, // no url
          { url: 'https://example.com/valid.jpg', width: 100, height: 100 },
        ],
      },
    };
    expect(selectBestThumbnailUrl(metadata)).toBe('https://example.com/valid.jpg');
  });

  it('falls back to track.thumbnail when thumbnails array is empty', () => {
    const metadata = {
      track: { thumbnails: [], thumbnail: 'https://example.com/direct.jpg' },
    };
    expect(selectBestThumbnailUrl(metadata)).toBe('https://example.com/direct.jpg');
  });

  it('falls back to metadata.thumbnail when track has no thumbnails or thumbnail', () => {
    const metadata = { thumbnail: 'https://example.com/meta.jpg' };
    expect(selectBestThumbnailUrl(metadata)).toBe('https://example.com/meta.jpg');
  });

  it('returns null when no thumbnail information is available', () => {
    expect(selectBestThumbnailUrl({})).toBeNull();
    expect(selectBestThumbnailUrl(null)).toBeNull();
  });
});

describe('downloadAndResizeCover', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: {},
    });
    createWriteStream.mockReturnValue({});
    pipeline.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls ffmpeg with correct arguments and resolves on exit code 0', async () => {
    spawn.mockReturnValue(makeMockProcess({ closeCode: 0 }));

    await expect(
      downloadAndResizeCover('https://example.com/thumb.jpg', '/out/cover.webp', '/tmp', 'my-slug')
    ).resolves.toBeUndefined();

    expect(spawn).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-quality', '80', '/out/cover.webp']),
      expect.any(Object)
    );
  });

  it('rejects when ffmpeg exits with a non-zero code', async () => {
    spawn.mockReturnValue(makeMockProcess({ closeCode: 1 }));

    await expect(
      downloadAndResizeCover('https://example.com/thumb.jpg', '/out/cover.webp', '/tmp', 'my-slug')
    ).rejects.toThrow('ffmpeg cover resize exited with code 1');
  });

  it('rejects when ffmpeg emits an error event', async () => {
    spawn.mockReturnValue(makeMockProcess({ error: new Error('spawn ENOENT') }));

    await expect(
      downloadAndResizeCover('https://example.com/thumb.jpg', '/out/cover.webp', '/tmp', 'my-slug')
    ).rejects.toThrow('spawn ENOENT');
  });

  it('rejects when the HTTP response is not ok', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 });

    await expect(
      downloadAndResizeCover('https://example.com/thumb.jpg', '/out/cover.webp', '/tmp', 'my-slug')
    ).rejects.toThrow('HTTP 404 fetching thumbnail');
  });

  it('cleans up the temp file on success', async () => {
    spawn.mockReturnValue(makeMockProcess({ closeCode: 0 }));

    await downloadAndResizeCover(
      'https://example.com/thumb.jpg',
      '/out/cover.webp',
      '/tmp',
      'my-slug'
    );

    expect(rmSync).toHaveBeenCalledWith('/tmp/my-slug-thumb-raw', { force: true });
  });

  it('cleans up the temp file even when ffmpeg fails', async () => {
    spawn.mockReturnValue(makeMockProcess({ closeCode: 2 }));

    await expect(
      downloadAndResizeCover('https://example.com/thumb.jpg', '/out/cover.webp', '/tmp', 'my-slug')
    ).rejects.toThrow();

    expect(rmSync).toHaveBeenCalledWith('/tmp/my-slug-thumb-raw', { force: true });
  });

  it('cleans up the temp file when HTTP fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 });

    await expect(
      downloadAndResizeCover('https://example.com/thumb.jpg', '/out/cover.webp', '/tmp', 'my-slug')
    ).rejects.toThrow();

    expect(rmSync).toHaveBeenCalledWith('/tmp/my-slug-thumb-raw', { force: true });
  });
});
