/**
 * Photo Signal App - Modular Architecture
 *
 * This is the orchestrator that wires together independent modules.
 * Each module has a single responsibility and clear contract.
 *
 * Modules can be developed in parallel by different AI agents
 * without conflicts or coupling.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCameraAccess } from './modules/camera-access';
import {
  usePhotoRecognition,
  computeActiveSettings,
  computeAiRecommendations,
} from './modules/photo-recognition';
import { useAudioPlayback } from './modules/audio-playback';
import { CameraView } from './modules/camera-view';
import { InfoDisplay } from './modules/concert-info';
import { GalleryLayout } from './modules/gallery-layout';
import type { Concert } from './types';
import type {
  RecognitionTelemetry,
  PhotoRecognitionOptions,
  TemporalTelemetrySnapshot,
} from './modules/photo-recognition/types';
import { useTripleTap, useFeatureFlags } from './modules/secret-settings';
import { dataService } from './services/data-service';
import { buildTemporalSnapshot } from './utils/telemetryUtils';
import { ROUTINE_DEFINITIONS } from './modules/debug-overlay';
import type { RoutineType } from './modules/debug-overlay';
import styles from './App.module.css';

const SecretSettings = lazy(async () => {
  const module = await import('./modules/secret-settings/SecretSettings');
  return { default: module.SecretSettings };
});

// Constants for retry guidance text
const RETRY_HINT_TEXT = 'tap play to retry';

const DebugOverlay = lazy(async () => {
  const module = await import('./modules/debug-overlay');
  return { default: module.DebugOverlay };
});

const ACCESS_STORAGE_KEY = 'photo-signal-access-until';
const DEFAULT_ACCESS_SESSION_HOURS = 12;
const DETAILS_RECOGNITION_COOLDOWN_MS = 2000;

interface AccessGateConfig {
  enabled: boolean;
  passcode: string;
  sessionMs: number;
}

const getAccessGateConfig = (): AccessGateConfig => {
  const passcode = (import.meta.env.VITE_ACCESS_PASSCODE ?? '').trim();
  const rawSessionHours = Number(
    import.meta.env.VITE_ACCESS_SESSION_HOURS ?? `${DEFAULT_ACCESS_SESSION_HOURS}`
  );
  const sessionHours =
    Number.isFinite(rawSessionHours) && rawSessionHours > 0
      ? rawSessionHours
      : DEFAULT_ACCESS_SESSION_HOURS;

  const isTestEnv = import.meta.env.MODE === 'test';

  return {
    enabled: !isTestEnv && passcode.length > 0,
    passcode,
    sessionMs: sessionHours * 60 * 60 * 1000,
  };
};

const hasValidAccessSession = (): boolean => {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return false;
  }

  try {
    const storedValue = window.localStorage.getItem(ACCESS_STORAGE_KEY);
    if (!storedValue) {
      return false;
    }

    const accessUntil = Number(storedValue);
    if (!Number.isFinite(accessUntil)) {
      window.localStorage.removeItem(ACCESS_STORAGE_KEY);
      return false;
    }

    return accessUntil > Date.now();
  } catch (error) {
    console.error('Error reading access session from localStorage:', error);
    return false;
  }
};

/**
 * Build a shuffled playlist for an artist, optionally placing a preferred song first.
 * The remaining songs are shuffled randomly behind it.
 */
function buildPlaylist(songs: Concert[], preferredId?: number): Concert[] {
  if (songs.length <= 1) return [...songs];
  const preferred = songs.find((s) => s.id === preferredId);
  const rest = songs.filter((s) => s.id !== preferredId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return preferred ? [preferred, ...rest] : rest;
}

function AppContent() {
  // State for landing view vs. active camera view
  const [isActive, setIsActive] = useState(false);

  // State for secret settings menu
  const [showSecretSettings, setShowSecretSettings] = useState(false);

  // Track whether debug overlay is currently visible/expanded
  const [isDebugOverlayVisible, setIsDebugOverlayVisible] = useState(true);

  // Telemetry recording state
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [selectedRoutine, setSelectedRoutine] = useState<RoutineType | null>(null);
  const capturedTelemetryRef = useRef<RecognitionTelemetry | null>(null);
  const temporalSnapshotsRef = useRef<TemporalTelemetrySnapshot[]>([]);
  // Always up-to-date ref — lets the countdown effect snapshot telemetry without adding
  // telemetryForExport to its dependency array (which would re-schedule the timer every frame).
  const liveTelemetryRef = useRef<RecognitionTelemetry | null>(null);

  // Track audio that is currently playing so we can keep music alive between scans
  const [activeConcert, setActiveConcert] = useState<Concert | null>(null);
  const [isConcertInfoVisible, setIsConcertInfoVisible] = useState(false);
  const [hasScannedPhotoLoadFailed, setHasScannedPhotoLoadFailed] = useState(false);
  const [closedConcertCooldown, setClosedConcertCooldown] = useState<{
    concertId: number;
    expiresAt: number;
  } | null>(null);

  // Playlist bookkeeping — stored in refs because these values are never rendered;
  // they exist solely to drive onSongEnd auto-advance without triggering re-renders.
  const playlistRef = useRef<Concert[]>([]);
  const playlistIndexRef = useRef(0);
  // activePlaylistBand IS rendered (used in effects and switch-prompt logic), so it stays state.
  const [activePlaylistBand, setActivePlaylistBand] = useState<string | null>(null);
  // Ref so onSongEnd can read it without stale closure
  const userPausedRef = useRef(false);
  // Ref to play fn so onSongEnd can call it without circular dep on useAudioPlayback return
  const playRef = useRef<((url: string) => void) | null>(null);

  // Audio test URL for the debug overlay's Test Song button
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);

  const previousAutoplayIdRef = useRef<number | null>(null);

  // Module: Feature Flags
  const { isEnabled } = useFeatureFlags();

  // Module: Secret Settings - Triple-tap detection
  useTripleTap({
    onTripleTap: () => {
      setShowSecretSettings(true);
    },
  });

  // Enforce a single curated visual system for all users
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Load the first available audio URL for the debug overlay's Test Song button
  const loadTestAudioUrl = useCallback(async () => {
    const concerts = await dataService.getConcerts();
    const withAudio = concerts.find((c) => !!c.audioFile);
    if (withAudio?.audioFile) {
      setTestAudioUrl(withAudio.audioFile);
    }
  }, []);

  useEffect(() => {
    void loadTestAudioUrl();
  }, [loadTestAudioUrl]);

  // Module: Camera Access (only initialize when active)
  const { stream, error, hasPermission, retry } = useCameraAccess({
    autoStart: isActive,
  });

  // Module: Photo Recognition (paused when secret menu is open)
  const recognitionOptions: PhotoRecognitionOptions = useMemo(
    () => ({
      // Keep debug info (and telemetry) active during a recording session even if the overlay
      // is collapsed so no frames are missed.
      enableDebugInfo: isDebugOverlayVisible || recordingState === 'recording',
      aspectRatio: 'auto',
      enableRectangleDetection: isEnabled('rectangle-detection'),
      similarityThreshold: 18,
      matchMarginThreshold: 5,
      sharpnessThreshold: 85,
      recognitionDelay: 180,
      continuousRecognition: true,
      enabled: !showSecretSettings && !isConcertInfoVisible,
    }),
    [isDebugOverlayVisible, recordingState, isEnabled, isConcertInfoVisible, showSecretSettings]
  );

  const {
    recognizedConcert,
    reset: resetRecognition,
    resetTelemetry,
    debugInfo,
    isRecognizing,
    detectedRectangle,
    rectangleConfidence,
  } = usePhotoRecognition(stream, recognitionOptions);

  useEffect(() => {
    if (!closedConcertCooldown) {
      return;
    }

    const remainingMs = closedConcertCooldown.expiresAt - Date.now();
    if (remainingMs <= 0) {
      setClosedConcertCooldown(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setClosedConcertCooldown(null);
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [closedConcertCooldown]);

  const activeRecognitionConcert = useMemo(() => {
    if (!recognizedConcert) {
      return null;
    }

    if (
      closedConcertCooldown &&
      closedConcertCooldown.concertId === recognizedConcert.id &&
      closedConcertCooldown.expiresAt > Date.now()
    ) {
      return null;
    }

    return recognizedConcert;
  }, [closedConcertCooldown, recognizedConcert]);

  useEffect(() => {
    if (activeRecognitionConcert) {
      setIsConcertInfoVisible(true);
    }
  }, [activeRecognitionConcert]);

  useEffect(() => {
    if (showSecretSettings) {
      setIsDebugOverlayVisible(false);
    }
  }, [showSecretSettings]);

  // Module: Audio Playback
  const {
    play,
    pause,
    stop,
    preload,
    crossfade,
    isPlaying,
    progress,
    playbackError,
    clearPlaybackError,
  } = useAudioPlayback({
    volume: 1.0,
    fadeTime: 1000,
    onSongEnd: () => {
      if (userPausedRef.current) return;
      const currentPlaylist = playlistRef.current;
      if (currentPlaylist.length <= 1) return;
      const nextIndex = (playlistIndexRef.current + 1) % currentPlaylist.length;
      const nextSong = currentPlaylist[nextIndex];
      if (nextSong?.audioFile && playRef.current) {
        playlistIndexRef.current = nextIndex;
        playRef.current(nextSong.audioFile);
        setActiveConcert(nextSong);
      }
    },
  });

  // Keep playRef in sync so onSongEnd (stable closure) can call the latest play fn
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  // Begin streaming the recognized track immediately so playback feels instant
  useEffect(() => {
    if (!activeRecognitionConcert) {
      return;
    }

    const selectedAudioUrl = activeRecognitionConcert.audioFile;

    if (!selectedAudioUrl) {
      return;
    }

    preload(selectedAudioUrl);
  }, [preload, activeRecognitionConcert]);

  // Auto-play newly recognized concerts whenever nothing is currently playing.
  useEffect(() => {
    const autoplayConcert = activeRecognitionConcert;

    if (!autoplayConcert) {
      previousAutoplayIdRef.current = null;
      return;
    }

    if (!isActive) {
      return;
    }

    const isNewAutoplayConcert = previousAutoplayIdRef.current !== autoplayConcert.id;
    previousAutoplayIdRef.current = autoplayConcert.id;

    if (!isNewAutoplayConcert || isPlaying) {
      return;
    }

    if (!autoplayConcert.audioFile) {
      return;
    }

    // Same artist is already in the active playlist — don't interrupt
    if (autoplayConcert.band === activePlaylistBand) {
      return;
    }

    // New artist: build a shuffled playlist starting from the recognized song
    const songs = dataService.getConcertsByBand(autoplayConcert.band);
    const newPlaylist = buildPlaylist(
      songs.length > 0 ? songs : [autoplayConcert],
      autoplayConcert.id
    );
    const firstSong = newPlaylist[0];
    if (!firstSong?.audioFile) {
      return;
    }

    userPausedRef.current = false;
    playlistRef.current = newPlaylist;
    playlistIndexRef.current = 0;
    setActivePlaylistBand(autoplayConcert.band);
    play(firstSong.audioFile);
    setActiveConcert(firstSong);
  }, [isActive, activeRecognitionConcert, isPlaying, play, activePlaylistBand]);

  const handleTogglePlayback = () => {
    const playbackTargetConcert =
      !isPlaying && activeRecognitionConcert ? activeRecognitionConcert : activeConcert;

    if (!playbackTargetConcert) {
      return;
    }

    const selectedAudioUrl = playbackTargetConcert.audioFile;
    if (!selectedAudioUrl) {
      return;
    }

    if (isPlaying) {
      userPausedRef.current = true;
      pause();
      return;
    }

    userPausedRef.current = false;
    clearPlaybackError();

    if (playbackTargetConcert.band !== activePlaylistBand) {
      // Different artist: rebuild the playlist so onSongEnd auto-advances within
      // the correct band rather than continuing a stale playlist from a previous artist.
      const songs = dataService.getConcertsByBand(playbackTargetConcert.band);
      const newPlaylist = buildPlaylist(
        songs.length > 0 ? songs : [playbackTargetConcert],
        playbackTargetConcert.id
      );
      const firstSong = newPlaylist[0];
      if (!firstSong?.audioFile) {
        return;
      }
      playlistRef.current = newPlaylist;
      playlistIndexRef.current = 0;
      setActivePlaylistBand(playbackTargetConcert.band);
      play(firstSong.audioFile);
      setActiveConcert(firstSong);
    } else {
      // Same artist: sync the playlist index to the specific song being resumed
      // so onSongEnd advances from the right position.
      const idx = playlistRef.current.findIndex((s) => s.id === playbackTargetConcert.id);
      if (idx !== -1) {
        playlistIndexRef.current = idx;
      }
      play(selectedAudioUrl);
      setActiveConcert(playbackTargetConcert);
    }
  };

  const handleCloseConcertInfo = useCallback(
    (concert: Concert | null) => {
      if (concert) {
        setClosedConcertCooldown({
          concertId: concert.id,
          expiresAt: Date.now() + DETAILS_RECOGNITION_COOLDOWN_MS,
        });
      }

      setIsConcertInfoVisible(false);
      resetRecognition();
    },
    [resetRecognition]
  );

  const playPlaylistTrack = useCallback(
    (indexDelta: number) => {
      const currentPlaylist = playlistRef.current;
      if (currentPlaylist.length <= 1) {
        return;
      }

      const nextIndex =
        (playlistIndexRef.current + indexDelta + currentPlaylist.length) % currentPlaylist.length;
      const targetTrack = currentPlaylist[nextIndex];

      if (!targetTrack?.audioFile) {
        return;
      }

      if (activeConcert && isPlaying) {
        crossfade(targetTrack.audioFile);
      } else {
        clearPlaybackError();
        play(targetTrack.audioFile);
      }

      userPausedRef.current = false;
      playlistIndexRef.current = nextIndex;
      setActivePlaylistBand(targetTrack.band);
      setActiveConcert(targetTrack);
      resetRecognition();
    },
    [activeConcert, clearPlaybackError, crossfade, isPlaying, play, resetRecognition]
  );

  const handlePreviousTrack = useCallback(() => {
    playPlaylistTrack(-1);
  }, [playPlaylistTrack]);

  const handleNextTrack = useCallback(() => {
    playPlaylistTrack(1);
  }, [playPlaylistTrack]);

  const attemptPortraitOrientationLock = () => {
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & {
          lock?: unknown;
        })
      | undefined;
    if (typeof orientation?.lock !== 'function') {
      return;
    }

    void (orientation.lock as (orientation: 'portrait-primary') => Promise<void>)(
      'portrait-primary'
    ).catch(() => {});
  };

  // Handle activation from landing view
  const handleActivate = () => {
    attemptPortraitOrientationLock();
    setIsActive(true);
  };

  const shutdownExperience = useCallback(() => {
    userPausedRef.current = true;
    stop();
    setIsActive(false);
    setIsConcertInfoVisible(false);
    setHasScannedPhotoLoadFailed(false);
    setClosedConcertCooldown(null);
    setActiveConcert(null);
    setActivePlaylistBand(null);
    playlistRef.current = [];
    playlistIndexRef.current = 0;
    previousAutoplayIdRef.current = null;
    resetRecognition();
  }, [resetRecognition, stop]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        shutdownExperience();
      }
    };

    const handlePageHide = () => {
      shutdownExperience();
    };

    const handleBeforeUnload = () => {
      shutdownExperience();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shutdownExperience]);

  const infoConcert = isConcertInfoVisible ? (activeRecognitionConcert ?? activeConcert) : null;
  const scannedPhotoUrl = infoConcert?.photoUrl ?? null;
  const shouldShowPhotoPlaceholder =
    !!isConcertInfoVisible && (!scannedPhotoUrl || hasScannedPhotoLoadFailed);
  const shouldShowScannedPhoto =
    !!isConcertInfoVisible && !!scannedPhotoUrl && !hasScannedPhotoLoadFailed;

  useEffect(() => {
    setHasScannedPhotoLoadFailed(false);
  }, [scannedPhotoUrl]);

  const isInfoActive = !!(infoConcert && activeConcert && activeConcert.id === infoConcert.id);
  const dropNeedleConcert =
    isPlaying &&
    infoConcert &&
    activeConcert &&
    infoConcert.band !== activeConcert.band &&
    infoConcert.audioFile
      ? infoConcert
      : null;

  const statusLabel = playbackError
    ? 'Playback Fault'
    : isInfoActive && isPlaying
      ? 'On Air'
      : activeRecognitionConcert && !isInfoActive
        ? 'Locked Frame'
        : isInfoActive
          ? 'Deck Paused'
          : 'Preview';

  const promptText = playbackError
    ? playbackError.toLowerCase().includes(RETRY_HINT_TEXT)
      ? playbackError
      : `${playbackError} Check stream access and tap Play to retry.`
    : dropNeedleConcert
      ? `New lock: ${dropNeedleConcert.band}. Tap Drop the Needle to switch artists.`
      : activeRecognitionConcert
        ? 'Signal is locked. Playback runs continuously until you pause.'
        : activeConcert
          ? 'Archive is still live. Pause any time to stop the deck.'
          : 'Aim at a print to lock signal and start the deck.';

  const handleDropNeedle = useCallback(() => {
    if (!dropNeedleConcert) {
      return;
    }

    const songs = dataService.getConcertsByBand(dropNeedleConcert.band);
    const newPlaylist = buildPlaylist(
      songs.length > 0 ? songs : [dropNeedleConcert],
      dropNeedleConcert.id
    );
    const firstSong = newPlaylist[0];
    if (!firstSong?.audioFile) {
      return;
    }

    clearPlaybackError();
    if (activeConcert && isPlaying) {
      crossfade(firstSong.audioFile);
    } else {
      play(firstSong.audioFile);
    }

    userPausedRef.current = false;
    playlistRef.current = newPlaylist;
    playlistIndexRef.current = 0;
    setActivePlaylistBand(dropNeedleConcert.band);
    setActiveConcert(firstSong);
    resetRecognition();
  }, [
    activeConcert,
    clearPlaybackError,
    crossfade,
    dropNeedleConcert,
    isPlaying,
    play,
    resetRecognition,
  ]);

  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const progressPercentage = Math.round(clampedProgress * 100);
  const progressColor = `hsl(${Math.round(210 + clampedProgress * 150)}, 80%, 70%)`;
  const nowPlayingLine = activeConcert
    ? activeConcert.songTitle
      ? `${activeConcert.band} — ${activeConcert.songTitle}`
      : activeConcert.band
    : null;
  const playbackButtonLabel = isPlaying ? 'Pause' : 'Play';

  const canNavigatePlaylist = playlistRef.current.length > 1;
  const shouldShowBottomPlayer = Boolean(activeConcert);

  const audioControls = shouldShowBottomPlayer ? (
    <section className={styles.playerBar} aria-label="Now playing controls">
      <div className={styles.playerHeader}>
        <div className={styles.playerTitleBlock}>
          <p className={styles.playerEyebrow}>Now Playing</p>
          <div className={styles.playerNowPlayingRow}>
            {activeConcert?.albumCoverUrl ? (
              <img
                src={activeConcert.albumCoverUrl}
                alt={`${activeConcert.band} album cover`}
                className={styles.playerAlbumCover}
                loading="lazy"
              />
            ) : null}
            <p className={styles.playerTitle}>{nowPlayingLine}</p>
          </div>
        </div>
        <p className={styles.playerProgress}>{progressPercentage}%</p>
      </div>

      <div className={styles.playerTimeline} aria-label="Song progress tracker">
        <div className={styles.playerTimelineRail}>
          <div
            className={styles.playerTimelineFill}
            style={{ width: `${progressPercentage}%`, backgroundColor: progressColor }}
          />
        </div>
      </div>

      <div className={styles.playerTransport}>
        <button
          type="button"
          className={styles.playerButtonSecondary}
          onClick={handlePreviousTrack}
          disabled={!canNavigatePlaylist}
          aria-label="Play previous track"
        >
          Previous
        </button>
        <button
          type="button"
          className={styles.playerButtonPrimary}
          onClick={handleTogglePlayback}
          aria-label={playbackButtonLabel}
        >
          {playbackButtonLabel}
        </button>
        <button
          type="button"
          className={styles.playerButtonSecondary}
          onClick={handleNextTrack}
          disabled={!canNavigatePlaylist}
          aria-label="Play next track"
        >
          Next
        </button>
      </div>
    </section>
  ) : null;

  const cameraView = shouldShowScannedPhoto ? (
    <div className={styles.scannedPhotoFrame} aria-label="Matched photo preview">
      <img
        src={scannedPhotoUrl}
        alt={`${infoConcert?.band ?? 'Matched concert'} scanned photograph`}
        className={styles.scannedPhotoImage}
        loading="eager"
        onError={() => setHasScannedPhotoLoadFailed(true)}
      />
    </div>
  ) : shouldShowPhotoPlaceholder ? (
    <div className={styles.scannedPhotoFrame} aria-label="Matched photo placeholder">
      <div className={styles.scannedPhotoPlaceholder}>Photo unavailable</div>
    </div>
  ) : (
    <CameraView
      stream={stream}
      error={error}
      hasPermission={hasPermission}
      onRetry={retry}
      detectedRectangle={detectedRectangle}
      rectangleConfidence={rectangleConfidence}
      showRectangleOverlay={isEnabled('rectangle-detection')}
    />
  );

  // Render info display that lives below the camera view in the stacked layout
  const infoDisplay = (
    <InfoDisplay
      concert={infoConcert}
      isVisible={!!infoConcert}
      statusLabel={statusLabel}
      promptText={promptText}
      onClose={() => handleCloseConcertInfo(infoConcert)}
      onSwitch={dropNeedleConcert ? handleDropNeedle : undefined}
      switchLabel="Drop the Needle"
    />
  );

  const telemetryForExport: RecognitionTelemetry | null = debugInfo?.telemetry ?? null;

  // Keep liveTelemetryRef in sync every render so the countdown effect can read the latest
  // value without it appearing in the effect's dependency array.
  liveTelemetryRef.current = telemetryForExport;

  const startRecording = useCallback(() => {
    resetTelemetry();
    capturedTelemetryRef.current = null;
    temporalSnapshotsRef.current = [];
    setSecondsRemaining(30);
    setRecordingState('recording');
  }, [resetTelemetry]);

  // Countdown — counts down once per second, then captures a snapshot.
  useEffect(() => {
    if (recordingState !== 'recording') return;
    if (secondsRemaining <= 0) {
      capturedTelemetryRef.current = liveTelemetryRef.current;
      setRecordingState('done');
      return;
    }

    // Capture temporal snapshots at t=10s and t=20s (when secondsRemaining hits 20 and 10).
    if (secondsRemaining === 20 || secondsRemaining === 10) {
      const live = liveTelemetryRef.current;
      if (live) {
        const elapsedSeconds = 30 - secondsRemaining;
        temporalSnapshotsRef.current = [
          ...temporalSnapshotsRef.current,
          buildTemporalSnapshot(live, elapsedSeconds),
        ];
      }
    }

    const timer = setTimeout(() => setSecondsRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [recordingState, secondsRemaining]);

  const handleTelemetryDownload = useCallback(() => {
    const telemetry = capturedTelemetryRef.current;
    if (!telemetry) return;

    const activeSettings = computeActiveSettings(recognitionOptions);
    const aiRecommendations = computeAiRecommendations(telemetry, activeSettings);

    const { blur, glare, lighting } = telemetry.frameQualityStats;
    const totalFailureEvents = Object.values(telemetry.failureByCategory).reduce(
      (sum, count) => sum + count,
      0
    );
    const { matchedFrameDistances, nearMisses } = telemetry.hammingDistanceLog;
    const topCollisionPairs = Object.entries(telemetry.collisionStats.ambiguousPairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pair, count]) => ({ pair, count }));

    const routineDef = selectedRoutine
      ? (ROUTINE_DEFINITIONS.find((r) => r.type === selectedRoutine) ?? null)
      : null;

    const routineContext = {
      routineType: selectedRoutine ?? 'unspecified',
      routineLabel: routineDef?.label ?? 'No routine selected',
      routineInstructions: routineDef?.instructions ?? '',
    };

    const report = {
      timestamp: new Date().toISOString(),
      recordingDurationMs: 30000,
      routineContext,
      sessionInfo: { userAgent: navigator.userAgent, exportedAt: new Date().toISOString() },
      activeSettings,
      aiRecommendations,
      summary: {
        totalFrames: telemetry.totalFrames,
        qualityFrames: telemetry.qualityFrames,
        qualityFrameRate:
          telemetry.totalFrames > 0
            ? ((telemetry.qualityFrames / telemetry.totalFrames) * 100).toFixed(1) + '%'
            : '0%',
        blurRejections: telemetry.blurRejections,
        blurRejectionRate:
          telemetry.totalFrames > 0
            ? ((telemetry.blurRejections / telemetry.totalFrames) * 100).toFixed(1) + '%'
            : '0%',
        glareRejections: telemetry.glareRejections,
        glareRejectionRate:
          telemetry.totalFrames > 0
            ? ((telemetry.glareRejections / telemetry.totalFrames) * 100).toFixed(1) + '%'
            : '0%',
        successfulRecognitions: telemetry.successfulRecognitions,
        failedAttempts: telemetry.failedAttempts,
        recognitionSuccessRate:
          telemetry.successfulRecognitions + telemetry.failedAttempts > 0
            ? (
                (telemetry.successfulRecognitions /
                  (telemetry.successfulRecognitions + telemetry.failedAttempts)) *
                100
              ).toFixed(1) + '%'
            : '0%',
        instantConfirmations: telemetry.instantConfirmations ?? 0,
        qualityBypassFrames: telemetry.qualityBypassFrames ?? 0,
      },
      temporalSnapshots: temporalSnapshotsRef.current,
      frameQualityStats: {
        blur: {
          ...blur,
          averageSharpness: blur.sampleCount > 0 ? blur.sharpnessSum / blur.sampleCount : null,
        },
        glare: {
          ...glare,
          averageGlarePercent:
            glare.sampleCount > 0 ? glare.glarePercentSum / glare.sampleCount : null,
        },
        lighting: {
          ...lighting,
          averageBrightness:
            lighting.sampleCount > 0 ? lighting.brightnessSum / lighting.sampleCount : null,
        },
      },
      hammingDistanceLog: {
        nearMisses,
        matchedFrameDistances: {
          ...matchedFrameDistances,
          average:
            matchedFrameDistances.count > 0
              ? matchedFrameDistances.sum / matchedFrameDistances.count
              : null,
        },
      },
      collisionStats: {
        ...telemetry.collisionStats,
        topAmbiguousPairs: topCollisionPairs,
      },
      failuresByCategory: Object.entries(telemetry.failureByCategory)
        .filter(([, count]) => count > 0)
        .map(([category, count]) => ({
          category,
          count,
          percentage:
            totalFailureEvents > 0 ? ((count / totalFailureEvents) * 100).toFixed(1) + '%' : '0%',
        })),
      recentFailures: telemetry.failureHistory.map((failure) => ({
        category: failure.category,
        reason: failure.reason,
        frameHash: failure.frameHash,
        timestamp: new Date(failure.timestamp).toISOString(),
      })),
      rawData: telemetry,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photo-signal-telemetry-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    capturedTelemetryRef.current = null;
    setRecordingState('idle');
  }, [recognitionOptions, selectedRoutine]);

  const handleTelemetryDiscard = useCallback(() => {
    capturedTelemetryRef.current = null;
    temporalSnapshotsRef.current = [];
    setSelectedRoutine(null);
    setRecordingState('idle');
  }, []);

  return (
    <>
      <GalleryLayout
        isActive={isActive}
        cameraView={cameraView}
        infoDisplay={infoDisplay}
        onActivate={handleActivate}
        onSettingsClick={() => setShowSecretSettings(true)}
        audioControls={audioControls}
      />
      {showSecretSettings && (
        <Suspense fallback={null}>
          <SecretSettings
            isVisible={showSecretSettings}
            onClose={() => {
              setShowSecretSettings(false);
            }}
          />
        </Suspense>
      )}
      {!showSecretSettings && isEnabled('show-debug-overlay') && (
        <Suspense fallback={null}>
          <DebugOverlay
            enabled
            isTestMode={false}
            recognizedConcert={activeRecognitionConcert}
            isRecognizing={isRecognizing}
            debugInfo={debugInfo}
            onReset={resetRecognition}
            onVisibilityChange={setIsDebugOverlayVisible}
            testAudioUrl={testAudioUrl}
            telemetryRecording={{
              state: recordingState,
              secondsRemaining,
              selectedRoutine,
              onSelectRoutine: setSelectedRoutine,
              onClearRoutine: () => setSelectedRoutine(null),
              onStart: startRecording,
              onDownload: handleTelemetryDownload,
              onDiscard: handleTelemetryDiscard,
            }}
          />
        </Suspense>
      )}
    </>
  );
}

function App() {
  const gateConfig = getAccessGateConfig();
  const [isUnlocked, setIsUnlocked] = useState(
    () => !gateConfig.enabled || hasValidAccessSession()
  );
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  useEffect(() => {
    if (!gateConfig.enabled) {
      setIsUnlocked(true);
      return;
    }

    setIsUnlocked(hasValidAccessSession());
  }, [gateConfig.enabled]);

  if (!gateConfig.enabled || isUnlocked) {
    return <AppContent />;
  }

  const handleUnlockSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (passcodeInput.trim() !== gateConfig.passcode) {
      setPasscodeError('Incorrect code. Please try again.');
      return;
    }

    try {
      window.localStorage.setItem(ACCESS_STORAGE_KEY, `${Date.now() + gateConfig.sessionMs}`);
    } catch (error) {
      console.error('Failed to persist access session to localStorage:', error);
    }

    setPasscodeError('');
    setPasscodeInput('');
    setIsUnlocked(true);
  };

  return (
    <main className="access-gate" aria-label="Private access gate">
      <section className="access-gate-card" aria-labelledby="access-gate-title">
        <h1 id="access-gate-title" className="access-gate-title">
          Private Gallery
        </h1>
        <p className="access-gate-description">Enter access code to begin.</p>
        <form className="access-gate-form" onSubmit={handleUnlockSubmit}>
          <label className="access-gate-label" htmlFor="access-code-input">
            Access code
          </label>
          <input
            id="access-code-input"
            className="access-gate-input"
            type="password"
            value={passcodeInput}
            onChange={(event) => {
              setPasscodeInput(event.target.value);
              if (passcodeError) {
                setPasscodeError('');
              }
            }}
            autoComplete="off"
            autoFocus
            inputMode="numeric"
          />
          {passcodeError ? (
            <p className="access-gate-error" role="alert">
              {passcodeError}
            </p>
          ) : null}
          <button type="submit" className="access-gate-button">
            Enter
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;
