import { describe, it, expect } from 'vitest';
import {
  normalizeBand,
  formatAudioUrl,
  sanitizePrefix,
  trimTrailingSlash,
  groupBy,
  buildConcertFromRow,
  findExtraTracks,
  buildExpandedConcerts,
} from '../build-data-from-photo-csv.js';

// ---------------------------------------------------------------------------
// normalizeBand
// ---------------------------------------------------------------------------
describe('normalizeBand', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeBand('Sigur Rós')).toBe('sigur ros');
  });

  it('removes "the" as a standalone word', () => {
    expect(normalizeBand('The Beatles')).toBe('beatles');
  });

  it('converts & to "and"', () => {
    expect(normalizeBand('Simon & Garfunkel')).toBe('simon and garfunkel');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeBand('   Big   Girl  ')).toBe('big girl');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeBand('')).toBe('');
    expect(normalizeBand(null)).toBe('');
    expect(normalizeBand(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatAudioUrl
// ---------------------------------------------------------------------------
describe('formatAudioUrl', () => {
  it('joins base, prefix, and filename', () => {
    expect(formatAudioUrl('https://cdn.example.com', 'prod/audio', 'track.opus')).toBe(
      'https://cdn.example.com/prod/audio/track.opus'
    );
  });

  it('strips trailing slash from base', () => {
    expect(formatAudioUrl('https://cdn.example.com/', 'prod/audio', 'track.opus')).toBe(
      'https://cdn.example.com/prod/audio/track.opus'
    );
  });

  it('strips leading/trailing slashes from prefix', () => {
    expect(formatAudioUrl('https://cdn.example.com', '/prod/audio/', 'track.opus')).toBe(
      'https://cdn.example.com/prod/audio/track.opus'
    );
  });

  it('omits prefix when empty', () => {
    expect(formatAudioUrl('https://cdn.example.com', '', 'track.opus')).toBe(
      'https://cdn.example.com/track.opus'
    );
  });
});

// ---------------------------------------------------------------------------
// sanitizePrefix / trimTrailingSlash
// ---------------------------------------------------------------------------
describe('sanitizePrefix', () => {
  it('removes leading and trailing slashes', () => {
    expect(sanitizePrefix('/prod/audio/')).toBe('prod/audio');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizePrefix('')).toBe('');
    expect(sanitizePrefix(null)).toBe('');
  });
});

describe('trimTrailingSlash', () => {
  it('removes a trailing slash', () => {
    expect(trimTrailingSlash('https://cdn.example.com/')).toBe('https://cdn.example.com');
  });

  it('leaves a non-trailing-slash URL unchanged', () => {
    expect(trimTrailingSlash('https://cdn.example.com')).toBe('https://cdn.example.com');
  });
});

// ---------------------------------------------------------------------------
// groupBy
// ---------------------------------------------------------------------------
describe('groupBy', () => {
  it('groups items by key selector', () => {
    const items = [
      { band: 'a', id: 1 },
      { band: 'b', id: 2 },
      { band: 'a', id: 3 },
    ];
    const grouped = groupBy(items, (item) => item.band);
    expect(grouped.get('a')).toHaveLength(2);
    expect(grouped.get('b')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// buildConcertFromRow
// ---------------------------------------------------------------------------
describe('buildConcertFromRow', () => {
  const baseUrl = 'https://cdn.example.com';
  const prefix = 'prod/audio';

  const row = {
    band: 'Big Girl',
    songTitle: '',
    venue: 'The Fillmore',
    date: '2023-08-15T20:00:00-05:00',
    imageFile: '/assets/big-girl-1.jpg',
    camera: 'Nikon Z6',
    focalLength: '50mm',
    aperture: 'f/1.8',
    shutterSpeed: '1/250',
    iso: '400',
  };

  const track = {
    fileName: 'big-girl-song1.opus',
    songTitle: 'Velvet Room',
    normBand: 'big girl',
  };

  it('builds a concert with correct fields from track', () => {
    const concert = buildConcertFromRow(row, 42, track, baseUrl, prefix);
    expect(concert.id).toBe(42);
    expect(concert.band).toBe('Big Girl');
    expect(concert.songTitle).toBe('Velvet Room');
    expect(concert.audioFile).toBe('https://cdn.example.com/prod/audio/big-girl-song1.opus');
    expect(concert.venue).toBe('The Fillmore');
    expect(concert.photoHashes).toEqual({});
  });

  it('prefers CSV songTitle over track songTitle', () => {
    const rowWithTitle = { ...row, songTitle: 'CSV Title' };
    const concert = buildConcertFromRow(rowWithTitle, 1, track, baseUrl, prefix);
    expect(concert.songTitle).toBe('CSV Title');
  });

  it('omits songTitle when neither CSV nor track provides one', () => {
    const trackNoTitle = { ...track, songTitle: '' };
    const concert = buildConcertFromRow(
      { ...row, songTitle: '' },
      1,
      trackNoTitle,
      baseUrl,
      prefix
    );
    expect(concert.songTitle).toBeUndefined();
  });

  it('uses fallback filename when selectedTrack is null', () => {
    const concert = buildConcertFromRow(row, 1, null, baseUrl, prefix);
    expect(concert.audioFile).toContain('concert-4.opus');
  });

  it('includes albumCoverUrl when track has coverFile', () => {
    const trackWithCover = { ...track, coverFile: 'ps-123-cover.webp' };
    const concert = buildConcertFromRow(row, 42, trackWithCover, baseUrl, prefix);
    expect(concert.albumCoverUrl).toBe('https://cdn.example.com/prod/audio/ps-123-cover.webp');
  });

  it('omits albumCoverUrl when track has no coverFile', () => {
    const concert = buildConcertFromRow(row, 42, track, baseUrl, prefix);
    expect(concert.albumCoverUrl).toBeUndefined();
  });

  it('omits albumCoverUrl when coverFile is null', () => {
    const trackWithNullCover = { ...track, coverFile: null };
    const concert = buildConcertFromRow(row, 42, trackWithNullCover, baseUrl, prefix);
    expect(concert.albumCoverUrl).toBeUndefined();
  });

  it('correctly formats albumCoverUrl with various base/prefix combinations', () => {
    const trackWithCover = { ...track, coverFile: 'ps-test-cover.webp' };

    // With trailing slash in base
    const concert1 = buildConcertFromRow(
      row,
      1,
      trackWithCover,
      'https://cdn.example.com/',
      'prod/audio'
    );
    expect(concert1.albumCoverUrl).toBe('https://cdn.example.com/prod/audio/ps-test-cover.webp');

    // With leading/trailing slashes in prefix
    const concert2 = buildConcertFromRow(row, 1, trackWithCover, baseUrl, '/prod/audio/');
    expect(concert2.albumCoverUrl).toBe('https://cdn.example.com/prod/audio/ps-test-cover.webp');

    // With empty prefix
    const concert3 = buildConcertFromRow(row, 1, trackWithCover, baseUrl, '');
    expect(concert3.albumCoverUrl).toBe('https://cdn.example.com/ps-test-cover.webp');
  });
});

// ---------------------------------------------------------------------------
// findExtraTracks
// ---------------------------------------------------------------------------
describe('findExtraTracks', () => {
  const makeTrack = (id, normBand, fileName) => ({ id, normBand, fileName, songTitle: '' });
  const makeRow = (id, band) => ({ id: String(id), band });

  it('returns empty when all tracks are covered by photos', () => {
    const photoRowsByNormBand = new Map([['big girl', [makeRow(1, 'Big Girl')]]]);
    const tracksByNormBand = new Map([['big girl', [makeTrack('t1', 'big girl', 'song1.opus')]]]);
    expect(findExtraTracks(photoRowsByNormBand, tracksByNormBand)).toHaveLength(0);
  });

  it('returns extra tracks when more songs than photos', () => {
    const photoRowsByNormBand = new Map([['big girl', [makeRow(1, 'Big Girl')]]]);
    const tracksByNormBand = new Map([
      [
        'big girl',
        [
          makeTrack('t1', 'big girl', 'song1.opus'),
          makeTrack('t2', 'big girl', 'song2.opus'),
          makeTrack('t3', 'big girl', 'song3.opus'),
        ],
      ],
    ]);
    const extras = findExtraTracks(photoRowsByNormBand, tracksByNormBand);
    expect(extras).toHaveLength(2); // tracks t2 and t3 are uncovered
    expect(extras[0].track.fileName).toBe('song2.opus');
    expect(extras[1].track.fileName).toBe('song3.opus');
  });

  it('cycles through photo rows for sourceRow assignment', () => {
    const photoRows = [makeRow(1, 'Big Girl'), makeRow(2, 'Big Girl')];
    const photoRowsByNormBand = new Map([['big girl', photoRows]]);
    const tracksByNormBand = new Map([
      [
        'big girl',
        [
          makeTrack('t1', 'big girl', 'song1.opus'),
          makeTrack('t2', 'big girl', 'song2.opus'),
          makeTrack('t3', 'big girl', 'song3.opus'),
          makeTrack('t4', 'big girl', 'song4.opus'),
          makeTrack('t5', 'big girl', 'song5.opus'),
        ],
      ],
    ]);
    const extras = findExtraTracks(photoRowsByNormBand, tracksByNormBand);
    expect(extras).toHaveLength(3); // t3, t4, t5 are uncovered
    // cycles: extra[0] → row[0%2=0], extra[1] → row[1%2=1], extra[2] → row[2%2=0]
    expect(extras[0].sourceRow.id).toBe('1');
    expect(extras[1].sourceRow.id).toBe('2');
    expect(extras[2].sourceRow.id).toBe('1');
  });

  it('skips bands with no photo rows (audio-only bands)', () => {
    const photoRowsByNormBand = new Map(); // no photos for 'mystery band'
    const tracksByNormBand = new Map([
      ['mystery band', [makeTrack('t1', 'mystery band', 'song1.opus')]],
    ]);
    expect(findExtraTracks(photoRowsByNormBand, tracksByNormBand)).toHaveLength(0);
  });

  it('handles multiple bands simultaneously', () => {
    const photoRowsByNormBand = new Map([
      ['alpha', [makeRow(1, 'Alpha')]],
      ['beta', [makeRow(2, 'Beta'), makeRow(3, 'Beta')]],
    ]);
    const tracksByNormBand = new Map([
      ['alpha', [makeTrack('a1', 'alpha', 'a1.opus'), makeTrack('a2', 'alpha', 'a2.opus')]],
      ['beta', [makeTrack('b1', 'beta', 'b1.opus')]],
    ]);
    const extras = findExtraTracks(photoRowsByNormBand, tracksByNormBand);
    // Alpha has 1 photo + 2 tracks → 1 extra; Beta has 2 photos + 1 track → 0 extra
    expect(extras).toHaveLength(1);
    expect(extras[0].track.fileName).toBe('a2.opus');
  });
});

// ---------------------------------------------------------------------------
// buildExpandedConcerts
// ---------------------------------------------------------------------------
describe('buildExpandedConcerts', () => {
  const baseUrl = 'https://cdn.example.com';
  const prefix = 'prod/audio';

  const sourceRow = {
    band: 'Big Girl',
    songTitle: '',
    venue: 'The Fillmore',
    date: '2023-08-15T20:00:00-05:00',
    imageFile: '/assets/big-girl-1.jpg',
    camera: 'Nikon Z6',
    focalLength: '50mm',
    aperture: 'f/1.8',
    shutterSpeed: '1/250',
    iso: '400',
  };

  it('generates entries with sequential IDs starting from startId', () => {
    const extraTracks = [
      { track: { fileName: 'song2.opus', songTitle: 'Song Two' }, sourceRow },
      { track: { fileName: 'song3.opus', songTitle: 'Song Three' }, sourceRow },
    ];
    const entries = buildExpandedConcerts(extraTracks, baseUrl, prefix, 100);
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe(100);
    expect(entries[1].id).toBe(101);
  });

  it('copies band and venue from sourceRow', () => {
    const extraTracks = [{ track: { fileName: 'song2.opus', songTitle: 'Song Two' }, sourceRow }];
    const [entry] = buildExpandedConcerts(extraTracks, baseUrl, prefix, 50);
    expect(entry.band).toBe('Big Girl');
    expect(entry.venue).toBe('The Fillmore');
    expect(entry.imageFile).toBe('/assets/big-girl-1.jpg');
  });

  it('sets songTitle from the audio track', () => {
    const extraTracks = [{ track: { fileName: 'song2.opus', songTitle: 'Extra Hit' }, sourceRow }];
    const [entry] = buildExpandedConcerts(extraTracks, baseUrl, prefix, 50);
    expect(entry.songTitle).toBe('Extra Hit');
  });

  it('omits songTitle when track has no title', () => {
    const extraTracks = [{ track: { fileName: 'song2.opus', songTitle: '' }, sourceRow }];
    const [entry] = buildExpandedConcerts(extraTracks, baseUrl, prefix, 50);
    expect(entry.songTitle).toBeUndefined();
  });

  it('sets photoHashes to empty object (not recognizable by camera)', () => {
    const extraTracks = [{ track: { fileName: 'song2.opus', songTitle: '' }, sourceRow }];
    const [entry] = buildExpandedConcerts(extraTracks, baseUrl, prefix, 50);
    expect(entry.photoHashes).toEqual({});
  });

  it('builds correct audioFile URL', () => {
    const extraTracks = [{ track: { fileName: 'song2.opus', songTitle: '' }, sourceRow }];
    const [entry] = buildExpandedConcerts(extraTracks, baseUrl, prefix, 50);
    expect(entry.audioFile).toBe('https://cdn.example.com/prod/audio/song2.opus');
  });

  it('returns empty array for empty input', () => {
    expect(buildExpandedConcerts([], baseUrl, prefix, 100)).toEqual([]);
  });

  it('includes albumCoverUrl when track has coverFile', () => {
    const extraTracks = [
      {
        track: { fileName: 'song2.opus', songTitle: 'Song Two', coverFile: 'ps-cover2.webp' },
        sourceRow,
      },
    ];
    const [entry] = buildExpandedConcerts(extraTracks, baseUrl, prefix, 50);
    expect(entry.albumCoverUrl).toBe('https://cdn.example.com/prod/audio/ps-cover2.webp');
  });

  it('omits albumCoverUrl when track has no coverFile', () => {
    const extraTracks = [{ track: { fileName: 'song2.opus', songTitle: 'Song Two' }, sourceRow }];
    const [entry] = buildExpandedConcerts(extraTracks, baseUrl, prefix, 50);
    expect(entry.albumCoverUrl).toBeUndefined();
  });

  it('omits albumCoverUrl when coverFile is null', () => {
    const extraTracks = [
      { track: { fileName: 'song2.opus', songTitle: 'Song Two', coverFile: null }, sourceRow },
    ];
    const [entry] = buildExpandedConcerts(extraTracks, baseUrl, prefix, 50);
    expect(entry.albumCoverUrl).toBeUndefined();
  });

  it('matches URL format with buildConcertFromRow', () => {
    const extraTracks = [
      {
        track: { fileName: 'song2.opus', songTitle: 'Song Two', coverFile: 'ps-cover2.webp' },
        sourceRow,
      },
    ];
    const [expandedEntry] = buildExpandedConcerts(extraTracks, baseUrl, prefix, 50);

    const track = { fileName: 'song2.opus', songTitle: 'Song Two', coverFile: 'ps-cover2.webp' };
    const directEntry = buildConcertFromRow(sourceRow, 50, track, baseUrl, prefix);

    expect(expandedEntry.albumCoverUrl).toBe(directEntry.albumCoverUrl);
  });
});

// ---------------------------------------------------------------------------
// Integration: full expansion scenario
// ---------------------------------------------------------------------------
describe('auto-expansion integration', () => {
  it('generates correct total when band has 1 photo and 3 songs', () => {
    const photoRowsByNormBand = new Map([
      [
        'big girl',
        [
          {
            id: '1',
            band: 'Big Girl',
            songTitle: '',
            venue: 'The Fillmore',
            date: '2023-08-15T20:00:00-05:00',
            imageFile: '/assets/bg1.jpg',
            camera: '',
            focalLength: '',
            aperture: '',
            shutterSpeed: '',
            iso: '',
          },
        ],
      ],
    ]);
    const tracksByNormBand = new Map([
      [
        'big girl',
        [
          { id: 't1', normBand: 'big girl', fileName: 'bg-a.opus', songTitle: 'Song A' },
          { id: 't2', normBand: 'big girl', fileName: 'bg-b.opus', songTitle: 'Song B' },
          { id: 't3', normBand: 'big girl', fileName: 'bg-c.opus', songTitle: 'Song C' },
        ],
      ],
    ]);

    const extras = findExtraTracks(photoRowsByNormBand, tracksByNormBand);
    expect(extras).toHaveLength(2); // bg-b and bg-c

    const expanded = buildExpandedConcerts(extras, 'https://cdn.example.com', 'prod/audio', 10);
    expect(expanded).toHaveLength(2);
    expect(expanded[0].audioFile).toContain('bg-b.opus');
    expect(expanded[0].songTitle).toBe('Song B');
    expect(expanded[1].audioFile).toContain('bg-c.opus');
    expect(expanded[1].songTitle).toBe('Song C');

    // Both extra entries should share the band's only photo row metadata
    expect(expanded[0].imageFile).toBe('/assets/bg1.jpg');
    expect(expanded[1].imageFile).toBe('/assets/bg1.jpg');
  });
});
