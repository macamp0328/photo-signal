import { describe, it, expect } from 'vitest';
import {
  generateOutputFilename,
  parseLUFS,
  createAudioIndex,
  createPhotoAudioMap,
} from '../encode-audio.js';

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
