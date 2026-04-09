import type { Concert } from './types';

export const RETRY_HINT_TEXT = 'tap play to retry.';

export type ExperienceStatus =
  | 'idle'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'switch-available'
  | 'error';

interface PlaylistStartResult {
  playlist: Concert[];
  firstSong: Concert | null;
}

interface PlaylistSyncResult {
  playlist: Concert[];
  playlistIndex: number;
  activePlaylistBand: string;
  concert: Concert;
}

interface PlaylistAdvanceResult {
  playlist: Concert[];
  playlistIndex: number;
  activePlaylistBand: string;
  nextSong: Concert | null;
}

export function getExperienceStatus({
  hasPlaybackError,
  hasSwitchCandidate,
  isPlaying,
  hasReadyMatch,
  hasPausedTrack,
}: {
  hasPlaybackError: boolean;
  hasSwitchCandidate: boolean;
  isPlaying: boolean;
  hasReadyMatch: boolean;
  hasPausedTrack: boolean;
}): ExperienceStatus {
  if (hasPlaybackError) {
    return 'error';
  }

  if (hasSwitchCandidate) {
    return 'switch-available';
  }

  if (isPlaying) {
    return 'playing';
  }

  if (hasReadyMatch) {
    return 'ready';
  }

  if (hasPausedTrack) {
    return 'paused';
  }

  return 'idle';
}

export function withRetryHint(playbackError: string, retrySuffix: string): string {
  return playbackError.toLowerCase().includes(RETRY_HINT_TEXT)
    ? playbackError
    : `${playbackError} ${retrySuffix}`;
}

export function shufflePlaylist(songs: Concert[]): Concert[] {
  const shuffledSongs = [...songs];
  for (let i = shuffledSongs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledSongs[i], shuffledSongs[j]] = [shuffledSongs[j], shuffledSongs[i]];
  }
  return shuffledSongs;
}

export function getPlaylistStartForConcert(
  concert: Concert,
  songsByBand: Concert[]
): PlaylistStartResult {
  const allSongs = songsByBand.length > 0 ? songsByBand : [concert];
  const otherSongs = allSongs.filter((s) => s.id !== concert.id);
  const playlist = [concert, ...shufflePlaylist(otherSongs)];

  if (!concert.audioFile) {
    return { playlist, firstSong: null };
  }

  return { playlist, firstSong: concert };
}

export function syncPlaylistForConcert({
  concert,
  currentPlaylist,
  activePlaylistBand,
  songsByBand,
}: {
  concert: Concert;
  currentPlaylist: Concert[];
  activePlaylistBand: string | null;
  songsByBand: Concert[];
}): PlaylistSyncResult {
  let nextPlaylist = currentPlaylist;
  const needsRebuild =
    nextPlaylist.length === 0 ||
    activePlaylistBand !== concert.band ||
    !nextPlaylist.some((song) => song.id === concert.id);

  if (needsRebuild) {
    nextPlaylist = shufflePlaylist(songsByBand.length > 0 ? songsByBand : [concert]);
  }

  let nextIndex = nextPlaylist.findIndex((song) => song.id === concert.id);

  if (nextIndex === -1) {
    nextPlaylist = [concert];
    nextIndex = 0;
  }

  return {
    playlist: nextPlaylist,
    playlistIndex: nextIndex,
    activePlaylistBand: concert.band,
    concert: nextPlaylist[nextIndex] ?? concert,
  };
}

export function getNextTrackAfterForwardAdvanceState({
  currentConcert,
  currentPlaylist,
  playlistIndex,
  activePlaylistBand,
  songsByBand,
}: {
  currentConcert: Concert | null;
  currentPlaylist: Concert[];
  playlistIndex: number;
  activePlaylistBand: string | null;
  songsByBand: Concert[];
}): PlaylistAdvanceResult | null {
  if (!currentConcert) {
    return null;
  }

  let nextPlaylist = currentPlaylist;
  const playlistHasCurrentConcert = nextPlaylist.some((song) => song.id === currentConcert.id);

  if (
    nextPlaylist.length === 0 ||
    activePlaylistBand !== currentConcert.band ||
    !playlistHasCurrentConcert
  ) {
    nextPlaylist = shufflePlaylist(songsByBand.length > 0 ? songsByBand : [currentConcert]);
    const rebuiltIndex = nextPlaylist.findIndex((song) => song.id === currentConcert.id);

    nextPlaylist = nextPlaylist.length > 0 ? nextPlaylist : [currentConcert];
    playlistIndex = rebuiltIndex >= 0 ? rebuiltIndex : 0;
  }

  if (nextPlaylist.length <= 1) {
    return {
      playlist: nextPlaylist,
      playlistIndex,
      activePlaylistBand: currentConcert.band,
      nextSong: null,
    };
  }

  const isWrap = playlistIndex >= nextPlaylist.length - 1;
  if (isWrap) {
    const reshuffledPlaylist = shufflePlaylist(nextPlaylist);
    return {
      playlist: reshuffledPlaylist,
      playlistIndex: 0,
      activePlaylistBand: currentConcert.band,
      nextSong: reshuffledPlaylist[0] ?? null,
    };
  }

  const nextIndex = playlistIndex + 1;
  return {
    playlist: nextPlaylist,
    playlistIndex: nextIndex,
    activePlaylistBand: currentConcert.band,
    nextSong: nextPlaylist[nextIndex] ?? null,
  };
}

export function getUpcomingTracksForPreload(
  currentPlaylist: Concert[],
  currentIndex: number,
  limit: number
): Concert[] {
  if (currentPlaylist.length <= 1 || limit <= 0) {
    return [];
  }

  const upcomingTracks: Concert[] = [];
  const seenTrackIds = new Set<number>();

  for (
    let offset = 1;
    offset < currentPlaylist.length && upcomingTracks.length < limit;
    offset += 1
  ) {
    const track = currentPlaylist[(currentIndex + offset) % currentPlaylist.length];

    if (!track?.audioFile || seenTrackIds.has(track.id)) {
      continue;
    }

    seenTrackIds.add(track.id);
    upcomingTracks.push(track);
  }

  return upcomingTracks;
}
