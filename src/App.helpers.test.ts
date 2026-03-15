import { describe, expect, it } from 'vitest';
import type { Concert } from './types';
import {
  getExperienceStatus,
  getNextTrackAfterForwardAdvanceState,
  getPlaylistStartForConcert,
  syncPlaylistForConcert,
  withRetryHint,
} from './App.playback-helpers';

const concertOne: Concert = {
  id: 1,
  band: 'Band One',
  venue: 'Venue One',
  date: '2024-01-01T20:00:00-05:00',
  audioFile: '/audio/one.opus',
  imageFile: '/images/one.jpg',
  photoUrl: 'https://photo-cdn.example.com/prod/photos/one.jpg',
  photoHashes: {
    phash: ['0123456789abcdef'],
  },
};

const concertTwo: Concert = {
  ...concertOne,
  id: 2,
  band: 'Band Two',
  audioFile: '/audio/two.opus',
};

const sameBandTrackTwo: Concert = {
  ...concertOne,
  id: 101,
  songTitle: 'Band One Track Two',
  audioFile: '/audio/one-b.opus',
};

describe('App playback helpers', () => {
  it('applies experience status precedence consistently', () => {
    expect(
      getExperienceStatus({
        hasPlaybackError: true,
        hasSwitchCandidate: true,
        isPlaying: true,
        hasReadyMatch: true,
        hasPausedTrack: true,
      })
    ).toBe('error');

    expect(
      getExperienceStatus({
        hasPlaybackError: false,
        hasSwitchCandidate: true,
        isPlaying: true,
        hasReadyMatch: true,
        hasPausedTrack: true,
      })
    ).toBe('switch-available');

    expect(
      getExperienceStatus({
        hasPlaybackError: false,
        hasSwitchCandidate: false,
        isPlaying: false,
        hasReadyMatch: false,
        hasPausedTrack: false,
      })
    ).toBe('idle');
  });

  it('preserves retry guidance when already present and appends it when missing', () => {
    expect(withRetryHint('Audio failed to start. Tap Play to retry.', 'unused')).toBe(
      'Audio failed to start. Tap Play to retry.'
    );

    expect(
      withRetryHint(
        'Audio failed to load. Check your connection and try again.',
        'Check the connection, then tap Play again.'
      )
    ).toBe(
      'Audio failed to load. Check your connection and try again. Check the connection, then tap Play again.'
    );
  });

  it('returns no playable start when the playlist resolves to a track without audio', () => {
    const noAudioTrack: Concert = {
      ...concertTwo,
      audioFile: '',
    };

    const result = getPlaylistStartForConcert(concertTwo, [noAudioTrack]);

    expect(result.firstSong).toBeNull();
    expect(result.playlist).toEqual([noAudioTrack]);
  });

  it('rebuilds a stale playlist and falls back to the requested concert when the rebuild omits it', () => {
    const result = syncPlaylistForConcert({
      concert: sameBandTrackTwo,
      currentPlaylist: [concertOne],
      activePlaylistBand: concertOne.band,
      songsByBand: [concertOne],
    });

    expect(result.playlist).toEqual([sameBandTrackTwo]);
    expect(result.playlistIndex).toBe(0);
    expect(result.activePlaylistBand).toBe(sameBandTrackTwo.band);
    expect(result.concert).toEqual(sameBandTrackTwo);
  });

  it('returns null when advancing without an active concert', () => {
    expect(
      getNextTrackAfterForwardAdvanceState({
        currentConcert: null,
        currentPlaylist: [],
        playlistIndex: 0,
        activePlaylistBand: null,
        songsByBand: [],
      })
    ).toBeNull();
  });

  it('rebuilds around the current concert before determining there is no next track', () => {
    const result = getNextTrackAfterForwardAdvanceState({
      currentConcert: sameBandTrackTwo,
      currentPlaylist: [],
      playlistIndex: 0,
      activePlaylistBand: null,
      songsByBand: [sameBandTrackTwo],
    });

    expect(result).toEqual({
      playlist: [sameBandTrackTwo],
      playlistIndex: 0,
      activePlaylistBand: sameBandTrackTwo.band,
      nextSong: null,
    });
  });
});
