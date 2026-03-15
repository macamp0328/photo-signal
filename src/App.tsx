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
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCameraAccess } from './modules/camera-access';
import { usePhotoRecognition } from './modules/photo-recognition';
import { useAudioPlayback } from './modules/audio-playback';
import { CameraView } from './modules/camera-view';
import { InfoDisplay } from './modules/concert-info';
import { GalleryLayout } from './modules/gallery-layout';
import type { Concert } from './types';
import type { PhotoRecognitionOptions } from './modules/photo-recognition/types';
import { useFeatureFlags } from './modules/secret-settings';
import { dataService } from './services/data-service';
import { preloadRecognitionIndex } from './services/recognition-index-service';
import {
  getExperienceStatus,
  getNextTrackAfterForwardAdvanceState,
  getPlaylistStartForConcert,
  shufflePlaylist,
  syncPlaylistForConcert,
  withRetryHint,
} from './App.playback-helpers';
import { applyConcertPalette, resetToDeadSignal } from './utils/concert-palette';
import styles from './App.module.css';

const SecretSettings = lazy(async () => {
  const module = await import('./modules/secret-settings/SecretSettings');
  return { default: module.SecretSettings };
});

const UX_COPY = {
  status: {
    error: 'Playback Trouble',
    'switch-available': 'New Artist',
    playing: 'Now Playing',
    ready: 'Match Found',
    paused: 'Paused',
    idle: 'Scan a Photo',
  },
  prompt: {
    retrySuffix: 'Check the connection, then tap Play again.',
    'switch-available': (band: string) => `${band} is queued up. Tap Switch Artist to swap over.`,
    ready: 'Found a match. Tap Play to hear it.',
    playing: "Music's rolling. Pause it or keep scanning.",
    paused: 'Holding your spot. Tap Play to jump back in.',
    idle: 'Point at a photo to get things rolling.',
  },
  actions: {
    switchArtist: 'Switch Artist',
  },
} as const;

const DebugOverlay = lazy(async () => {
  const module = await import('./modules/debug-overlay');
  return { default: module.DebugOverlay };
});

const ACCESS_STORAGE_KEY = 'photo-signal-access-until';
const DEFAULT_ACCESS_SESSION_HOURS = 12;
const DETAILS_RECOGNITION_COOLDOWN_MS = 2000;
const LONG_PRESS_DURATION_MS = 500;
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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

function AppContent() {
  // State for landing view vs. active camera view
  const [isActive, setIsActive] = useState(false);

  // State for secret settings menu
  const [showSecretSettings, setShowSecretSettings] = useState(false);

  // Track whether debug overlay is currently visible/expanded
  const [isDebugOverlayVisible, setIsDebugOverlayVisible] = useState(false);

  // Track audio that is currently playing so we can keep music alive between scans
  const [activeConcert, setActiveConcert] = useState<Concert | null>(null);
  const [isConcertInfoVisible, setIsConcertInfoVisible] = useState(false);
  const [hasScannedPhotoLoadFailed, setHasScannedPhotoLoadFailed] = useState(false);
  const [isZoomedPhotoVisible, setIsZoomedPhotoVisible] = useState(false);
  const [isDownloadPromptVisible, setIsDownloadPromptVisible] = useState(false);
  const [closedConcertCooldown, setClosedConcertCooldown] = useState<{
    concertId: number;
    expiresAt: number;
  } | null>(null);
  const matchedPhotoButtonRef = useRef<HTMLButtonElement | null>(null);
  const zoomDialogRef = useRef<HTMLDivElement | null>(null);
  const zoomCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const zoomPreviousFocusRef = useRef<HTMLElement | null>(null);
  const downloadPromptDialogRef = useRef<HTMLDivElement | null>(null);
  const downloadCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const downloadPreviousFocusRef = useRef<HTMLElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressNextPhotoClickRef = useRef(false);

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
  const activeConcertRef = useRef<Concert | null>(null);
  const activePlaylistBandRef = useRef<string | null>(null);

  useEffect(() => {
    activeConcertRef.current = activeConcert;
  }, [activeConcert]);

  useEffect(() => {
    activePlaylistBandRef.current = activePlaylistBand;
  }, [activePlaylistBand]);

  const buildPlaylistForConcert = useCallback((concert: Concert) => {
    const songs = dataService.getConcertsByBand(concert.band);
    return getPlaylistStartForConcert(concert, songs);
  }, []);

  const startPlaylistForConcert = useCallback(
    (concert: Concert) => {
      const { playlist, firstSong } = buildPlaylistForConcert(concert);

      if (!firstSong) {
        return null;
      }

      playlistRef.current = playlist;
      playlistIndexRef.current = 0;
      setActivePlaylistBand(concert.band);

      return firstSong;
    },
    [buildPlaylistForConcert]
  );

  const syncPlaylistToConcert = useCallback((concert: Concert) => {
    const result = syncPlaylistForConcert({
      concert,
      currentPlaylist: playlistRef.current,
      activePlaylistBand: activePlaylistBandRef.current,
      songsByBand: dataService.getConcertsByBand(concert.band),
    });

    playlistRef.current = result.playlist;
    playlistIndexRef.current = result.playlistIndex;
    setActivePlaylistBand(result.activePlaylistBand);

    return result.concert;
  }, []);

  const getNextTrackAfterForwardAdvance = useCallback(() => {
    const result = getNextTrackAfterForwardAdvanceState({
      currentConcert: activeConcertRef.current,
      currentPlaylist: playlistRef.current,
      playlistIndex: playlistIndexRef.current,
      activePlaylistBand: activePlaylistBandRef.current,
      songsByBand: activeConcertRef.current
        ? dataService.getConcertsByBand(activeConcertRef.current.band)
        : [],
    });

    if (!result) {
      return null;
    }

    playlistRef.current = result.playlist;
    playlistIndexRef.current = result.playlistIndex;
    setActivePlaylistBand(result.activePlaylistBand);
    return result.nextSong;
  }, []);

  // Audio test URL for the debug overlay's Test Song button
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);

  const previousAutoplayIdRef = useRef<number | null>(null);

  // Module: Feature Flags
  const { isEnabled } = useFeatureFlags();

  // Enforce a single curated visual system for all users
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Load the first available audio URL for the debug overlay's Test Song button
  const loadTestAudioUrl = useCallback(async () => {
    try {
      const concerts = await dataService.getConcerts();
      const withAudio = concerts.find((c) => !!c.audioFile);
      if (withAudio?.audioFile) {
        setTestAudioUrl(withAudio.audioFile);
      }
    } catch (error) {
      console.warn('[App] Test audio bootstrap skipped: unable to load concerts', error);
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
      enableDebugInfo: isDebugOverlayVisible,
      aspectRatio: 'auto',
      enableRectangleDetection: isEnabled('rectangle-detection'),
      similarityThreshold: 18,
      matchMarginThreshold: 5,
      sharpnessThreshold: 85,
      recognitionDelay: 180,
      continuousRecognition: true,
      enabled: !showSecretSettings && !isConcertInfoVisible,
    }),
    [isDebugOverlayVisible, isEnabled, isConcertInfoVisible, showSecretSettings]
  );

  const {
    recognizedConcert,
    reset: resetRecognition,
    forceMatch,
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

  // Apply concert-specific gig poster palette when a concert is matched; revert to dead signal otherwise.
  // Cleanup on unmount ensures data-state and --poster-* vars don't leak into future mounts.
  useEffect(() => {
    if (activeRecognitionConcert) {
      applyConcertPalette(activeRecognitionConcert.band, activeRecognitionConcert.date);
    } else {
      resetToDeadSignal();
    }
    return resetToDeadSignal;
  }, [activeRecognitionConcert]);

  useEffect(() => {
    if (showSecretSettings) {
      setIsDebugOverlayVisible(false);
    }
  }, [showSecretSettings]);

  // Module: Audio Playback
  const { play, pause, stop, preload, crossfade, isPlaying, progress, playbackError } =
    useAudioPlayback({
      volume: 1.0,
      fadeTime: 1000,
      onSongEnd: () => {
        if (userPausedRef.current) return;
        const nextSong = getNextTrackAfterForwardAdvance();
        if (nextSong?.audioFile && playRef.current) {
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

    // New artist: build a shuffled playlist and start from its random first track
    const firstSong = startPlaylistForConcert(autoplayConcert);
    if (!firstSong) {
      return;
    }

    userPausedRef.current = false;
    play(firstSong.audioFile);
    setActiveConcert(firstSong);
  }, [
    isActive,
    activeRecognitionConcert,
    isPlaying,
    play,
    activePlaylistBand,
    startPlaylistForConcert,
  ]);

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

    if (playbackTargetConcert.band !== activePlaylistBand) {
      const firstSong = startPlaylistForConcert(playbackTargetConcert);
      if (!firstSong) {
        return;
      }
      play(firstSong.audioFile);
      setActiveConcert(firstSong);
    } else {
      const resumeConcert = syncPlaylistToConcert(playbackTargetConcert);
      if (!resumeConcert.audioFile) {
        return;
      }

      play(resumeConcert.audioFile);
      setActiveConcert(resumeConcert);
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
      if (activeConcert) {
        syncPlaylistToConcert(activeConcert);
      }

      const currentPlaylist = playlistRef.current;
      if (currentPlaylist.length <= 1) {
        return;
      }

      const forwardWrap = indexDelta > 0 && playlistIndexRef.current >= currentPlaylist.length - 1;
      let workingPlaylist = currentPlaylist;
      let nextIndex =
        (playlistIndexRef.current + indexDelta + currentPlaylist.length) % currentPlaylist.length;

      if (forwardWrap) {
        workingPlaylist = shufflePlaylist(currentPlaylist);
        playlistRef.current = workingPlaylist;
        nextIndex = 0;
      }

      const targetTrack = workingPlaylist[nextIndex];

      if (!targetTrack?.audioFile) {
        return;
      }

      if (activeConcert && isPlaying) {
        crossfade(targetTrack.audioFile);
      } else {
        play(targetTrack.audioFile);
      }

      userPausedRef.current = false;
      playlistIndexRef.current = nextIndex;
      setActivePlaylistBand(targetTrack.band);
      setActiveConcert(targetTrack);
    },
    [activeConcert, crossfade, isPlaying, play, syncPlaylistToConcert]
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

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleCloseZoomedPhoto = useCallback(() => {
    setIsZoomedPhotoVisible(false);
  }, []);

  const handleCloseDownloadPrompt = useCallback(() => {
    setIsDownloadPromptVisible(false);
  }, []);

  const getPhotoDownloadFilename = useCallback((url: string) => {
    try {
      const parsedUrl = new URL(url, window.location.href);
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      const fileName = pathSegments[pathSegments.length - 1];
      return fileName || 'matched-photo.jpg';
    } catch {
      return 'matched-photo.jpg';
    }
  }, []);

  const restoreDialogFocus = useCallback((elementToRestore: HTMLElement | null) => {
    if (
      elementToRestore &&
      elementToRestore !== document.body &&
      document.contains(elementToRestore)
    ) {
      elementToRestore.focus();
      return;
    }

    matchedPhotoButtonRef.current?.focus();
  }, []);

  const shutdownExperience = useCallback(() => {
    clearLongPressTimer();
    userPausedRef.current = true;
    stop();
    setIsActive(false);
    setIsConcertInfoVisible(false);
    setHasScannedPhotoLoadFailed(false);
    setIsZoomedPhotoVisible(false);
    setIsDownloadPromptVisible(false);
    setClosedConcertCooldown(null);
    setActiveConcert(null);
    setActivePlaylistBand(null);
    playlistRef.current = [];
    playlistIndexRef.current = 0;
    previousAutoplayIdRef.current = null;
    resetRecognition();
  }, [clearLongPressTimer, resetRecognition, stop]);

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

  useEffect(() => {
    if (shouldShowScannedPhoto) {
      return;
    }

    clearLongPressTimer();
    setIsZoomedPhotoVisible(false);
    setIsDownloadPromptVisible(false);
  }, [clearLongPressTimer, shouldShowScannedPhoto]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  useEffect(() => {
    if (!isZoomedPhotoVisible) {
      return;
    }

    zoomPreviousFocusRef.current = document.activeElement as HTMLElement | null;
    zoomCloseButtonRef.current?.focus();

    return () => {
      restoreDialogFocus(zoomPreviousFocusRef.current);
      zoomPreviousFocusRef.current = null;
    };
  }, [isZoomedPhotoVisible, restoreDialogFocus]);

  useEffect(() => {
    if (!isDownloadPromptVisible) {
      return;
    }

    downloadPreviousFocusRef.current = document.activeElement as HTMLElement | null;
    downloadCancelButtonRef.current?.focus();

    return () => {
      restoreDialogFocus(downloadPreviousFocusRef.current);
      downloadPreviousFocusRef.current = null;
    };
  }, [isDownloadPromptVisible, restoreDialogFocus]);

  const trapDialogFocus = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, dialogElement: HTMLDivElement | null) => {
      if (event.key !== 'Tab' || !dialogElement) {
        return;
      }

      const focusableElements = Array.from(
        dialogElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    },
    []
  );

  const handleZoomDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseZoomedPhoto();
        return;
      }

      trapDialogFocus(event, zoomDialogRef.current);
    },
    [handleCloseZoomedPhoto, trapDialogFocus]
  );

  const handleDownloadDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseDownloadPrompt();
        return;
      }

      trapDialogFocus(event, downloadPromptDialogRef.current);
    },
    [handleCloseDownloadPrompt, trapDialogFocus]
  );

  const handleMatchedPhotoClick = useCallback(() => {
    if (suppressNextPhotoClickRef.current) {
      suppressNextPhotoClickRef.current = false;
      return;
    }

    setIsZoomedPhotoVisible(true);
  }, []);

  const startLongPress = useCallback(() => {
    suppressNextPhotoClickRef.current = false;
    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      suppressNextPhotoClickRef.current = true;
      handleCloseZoomedPhoto();
      setIsDownloadPromptVisible(true);
    }, LONG_PRESS_DURATION_MS);
  }, [clearLongPressTimer, handleCloseZoomedPhoto]);

  const handleMatchedPhotoMouseDown = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }

      startLongPress();
    },
    [startLongPress]
  );

  const handleDownloadMatchedPhoto = useCallback(async () => {
    if (!scannedPhotoUrl) {
      handleCloseDownloadPrompt();
      return;
    }

    try {
      const response = await fetch(scannedPhotoUrl);
      if (!response.ok || typeof window.URL.createObjectURL !== 'function') {
        window.location.assign(scannedPhotoUrl);
        return;
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = getPhotoDownloadFilename(scannedPhotoUrl);
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 0);
    } catch {
      window.location.assign(scannedPhotoUrl);
    } finally {
      handleCloseDownloadPrompt();
    }
  }, [getPhotoDownloadFilename, handleCloseDownloadPrompt, scannedPhotoUrl]);

  const isInfoActive = !!(infoConcert && activeConcert && activeConcert.id === infoConcert.id);
  const dropNeedleConcert =
    isPlaying &&
    infoConcert &&
    activeConcert &&
    infoConcert.band !== activeConcert.band &&
    infoConcert.audioFile
      ? infoConcert
      : null;

  const experienceStatus = getExperienceStatus({
    hasPlaybackError: Boolean(playbackError),
    hasSwitchCandidate: Boolean(dropNeedleConcert),
    isPlaying,
    hasReadyMatch: Boolean(activeRecognitionConcert && (!isInfoActive || !userPausedRef.current)),
    hasPausedTrack: Boolean(isInfoActive && activeConcert && !isPlaying && userPausedRef.current),
  });

  const statusLabel = UX_COPY.status[experienceStatus];

  const promptText = playbackError
    ? withRetryHint(playbackError, UX_COPY.prompt.retrySuffix)
    : experienceStatus === 'switch-available' && dropNeedleConcert
      ? UX_COPY.prompt['switch-available'](dropNeedleConcert.band)
      : experienceStatus === 'ready'
        ? UX_COPY.prompt.ready
        : experienceStatus === 'playing'
          ? UX_COPY.prompt.playing
          : experienceStatus === 'paused'
            ? UX_COPY.prompt.paused
            : UX_COPY.prompt.idle;

  const handleDropNeedle = useCallback(() => {
    if (!dropNeedleConcert) {
      return;
    }

    const firstSong = startPlaylistForConcert(dropNeedleConcert);
    if (!firstSong) {
      return;
    }

    if (activeConcert && isPlaying) {
      crossfade(firstSong.audioFile);
    } else {
      play(firstSong.audioFile);
    }

    userPausedRef.current = false;
    setActiveConcert(firstSong);
    resetRecognition();
  }, [
    activeConcert,
    crossfade,
    dropNeedleConcert,
    isPlaying,
    play,
    resetRecognition,
    startPlaylistForConcert,
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
      <button
        ref={matchedPhotoButtonRef}
        type="button"
        className={styles.scannedPhotoButton}
        aria-label="Open matched photo zoom"
        onClick={handleMatchedPhotoClick}
        onTouchStart={startLongPress}
        onTouchEnd={clearLongPressTimer}
        onTouchCancel={clearLongPressTimer}
        onTouchMove={clearLongPressTimer}
        onMouseDown={handleMatchedPhotoMouseDown}
        onMouseUp={clearLongPressTimer}
        onMouseLeave={clearLongPressTimer}
        onMouseMove={clearLongPressTimer}
        onContextMenu={(event) => event.preventDefault()}
      >
        <img
          src={scannedPhotoUrl}
          alt={`${infoConcert?.band ?? 'Matched concert'} scanned photograph`}
          className={styles.scannedPhotoImage}
          loading="eager"
          onError={() => setHasScannedPhotoLoadFailed(true)}
        />
      </button>
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
      switchLabel={UX_COPY.actions.switchArtist}
    />
  );

  const handleForceMatch = useCallback(async () => {
    try {
      const concerts = await dataService.getConcerts();
      const withAudio = concerts.find((c) => !!c.audioFile);
      if (withAudio) {
        forceMatch(withAudio);
      } else {
        console.warn('[App] Force match skipped: no concerts with an audioFile found');
      }
    } catch (error) {
      console.warn('[App] Force match failed: unable to load concerts', error);
    }
  }, [forceMatch]);

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
      {isZoomedPhotoVisible && shouldShowScannedPhoto && scannedPhotoUrl ? (
        <div
          className={styles.photoOverlayBackdrop}
          role="presentation"
          onClick={handleCloseZoomedPhoto}
          onKeyDown={handleZoomDialogKeyDown}
        >
          <div
            ref={zoomDialogRef}
            className={styles.photoOverlayDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Matched photo zoom"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={zoomCloseButtonRef}
              type="button"
              className={styles.photoOverlayCloseButton}
              onClick={handleCloseZoomedPhoto}
            >
              Close
            </button>
            <img
              src={scannedPhotoUrl}
              alt={`${infoConcert?.band ?? 'Matched concert'} scanned photograph zoomed view`}
              className={styles.photoOverlayImage}
              loading="eager"
            />
          </div>
        </div>
      ) : null}
      {isDownloadPromptVisible && shouldShowScannedPhoto ? (
        <div
          className={styles.photoOverlayBackdrop}
          role="presentation"
          onClick={handleCloseDownloadPrompt}
          onKeyDown={handleDownloadDialogKeyDown}
        >
          <div
            ref={downloadPromptDialogRef}
            className={styles.photoPromptDialog}
            role="dialog"
            aria-modal="true"
            aria-label="Download full-size photo"
            onClick={(event) => event.stopPropagation()}
          >
            <p className={styles.photoPromptText}>Download full-size photo?</p>
            <div className={styles.photoPromptActions}>
              <button
                ref={downloadCancelButtonRef}
                type="button"
                className={styles.photoPromptSecondaryButton}
                onClick={handleCloseDownloadPrompt}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.photoPromptPrimaryButton}
                onClick={handleDownloadMatchedPhoto}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
            recognizedConcert={activeRecognitionConcert}
            isRecognizing={isRecognizing}
            debugInfo={debugInfo}
            onReset={resetRecognition}
            onVisibilityChange={setIsDebugOverlayVisible}
            testAudioUrl={testAudioUrl}
            onForceMatch={handleForceMatch}
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
    if (gateConfig.enabled && !isUnlocked) {
      return;
    }

    preloadRecognitionIndex();
    void dataService.getConcerts().catch(() => {
      // AppContent and recognition hook log specific load failures.
    });
  }, [gateConfig.enabled, isUnlocked]);

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
