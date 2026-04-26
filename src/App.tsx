/**
 * Photo Signal App - Modular Architecture
 *
 * This is the orchestrator that wires together independent modules.
 * Each module has a single responsibility and clear contract.
 *
 * Modules can be developed in parallel by different AI agents
 * without conflicts or coupling.
 */

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCameraAccess } from './modules/camera-access';
import {
  computeActiveSettings,
  computeAiRecommendations,
  usePhotoRecognition,
} from './modules/photo-recognition';
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
  getNextTrackAfterForwardAdvanceState,
  getPlaylistStartForConcert,
  shufflePlaylist,
  syncPlaylistForConcert,
} from './App.playback-helpers';
import { applyConcertPalette, resetToDeadSignal } from './utils/concert-palette';
import { applyExifVisualCharacter, resetExifVisualCharacter } from './utils/exif-visual';
import { setUserType, clearUserType, isDemoUser } from './utils/userType';
import styles from './App.module.css';

const SecretSettings = lazy(async () => {
  const module = await import('./modules/secret-settings/SecretSettings');
  return { default: module.SecretSettings };
});

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
  demoPasscode: string;
  sessionMs: number;
  demoSessionMs: number;
}

const DEFAULT_DEMO_SESSION_HOURS = 4;

const getAccessGateConfig = (): AccessGateConfig => {
  const passcode = (import.meta.env.VITE_ACCESS_PASSCODE ?? '').trim();
  const demoPasscode = (import.meta.env.VITE_DEMO_PASSCODE ?? '').trim();
  const rawSessionHours = Number(
    import.meta.env.VITE_ACCESS_SESSION_HOURS ?? `${DEFAULT_ACCESS_SESSION_HOURS}`
  );
  const sessionHours =
    Number.isFinite(rawSessionHours) && rawSessionHours > 0
      ? rawSessionHours
      : DEFAULT_ACCESS_SESSION_HOURS;
  const rawDemoSessionHours = Number(
    import.meta.env.VITE_DEMO_SESSION_HOURS ?? `${DEFAULT_DEMO_SESSION_HOURS}`
  );
  const demoSessionHours =
    Number.isFinite(rawDemoSessionHours) && rawDemoSessionHours > 0
      ? rawDemoSessionHours
      : DEFAULT_DEMO_SESSION_HOURS;

  const isTestEnv = import.meta.env.MODE === 'test';

  return {
    enabled: !isTestEnv && (passcode.length > 0 || demoPasscode.length > 0),
    passcode,
    demoPasscode,
    sessionMs: sessionHours * 60 * 60 * 1000,
    demoSessionMs: demoSessionHours * 60 * 60 * 1000,
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
      clearUserType();
      return false;
    }

    if (accessUntil <= Date.now()) {
      clearUserType();
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error reading access session from localStorage:', error);
    return false;
  }
};

// DEV-only badge: visible when __dev_fakeCamera is active in localStorage so
// agents and humans can instantly confirm they're on the dev server (not
// the production preview build, which strips all DEV code paths).
function DevFakeCameraBadge() {
  if (!import.meta.env.DEV) return null;
  try {
    const raw = localStorage.getItem('__dev_fakeCamera');
    if (!raw) return null;
    const cfg = JSON.parse(raw) as { clips?: unknown[] };
    const count = Array.isArray(cfg.clips) ? cfg.clips.length : 1;
    return (
      <div
        style={{
          position: 'fixed',
          top: 48,
          left: 8,
          background: 'rgba(255, 200, 0, 0.92)',
          color: '#000',
          fontSize: '11px',
          fontFamily: 'monospace',
          padding: '3px 7px',
          borderRadius: '3px',
          zIndex: 9999,
          pointerEvents: 'none',
          letterSpacing: '0.03em',
        }}
        aria-hidden="true"
      >
        DEV · fake camera · {count} clip{count !== 1 ? 's' : ''}
      </div>
    );
  } catch {
    return null;
  }
}

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
  const [isDownloadPromptVisible, setIsDownloadPromptVisible] = useState(false);
  const [closedConcertCooldown, setClosedConcertCooldown] = useState<{
    concertId: number;
    expiresAt: number;
  } | null>(null);
  const downloadPromptDialogRef = useRef<HTMLDivElement | null>(null);
  const downloadCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const downloadPreviousFocusRef = useRef<HTMLElement | null>(null);
  const scanAnotherButtonRef = useRef<HTMLButtonElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  // Track data load failure so the landing page can surface an error
  const [dataLoadError, setDataLoadError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    dataService.getConcerts().catch(() => {
      if (!isCancelled) setDataLoadError(true);
    });
    return () => {
      isCancelled = true;
    };
  }, []);

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
    recognizingConcert,
    reset: resetRecognition,
    forceMatch,
    debugInfo,
    isRecognizing,
    detectedRectangle,
    rectangleConfidence,
    indexLoadFailed,
  } = usePhotoRecognition(stream, recognitionOptions);

  const hasDataError = dataLoadError || indexLoadFailed;

  const analysisSettings = useMemo(
    () => computeActiveSettings(recognitionOptions),
    [recognitionOptions]
  );

  const recognitionRecommendations = useMemo(() => {
    if (!isDebugOverlayVisible || !debugInfo) {
      return [];
    }

    return computeAiRecommendations(debugInfo.telemetry, analysisSettings);
  }, [analysisSettings, debugInfo, isDebugOverlayVisible]);

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
  // EXIF visual character vars are applied alongside the palette so each photo match feels unique.
  // Cleanup on unmount ensures data-state, --poster-*, and --exif-* vars don't leak into future mounts.
  useEffect(() => {
    if (activeRecognitionConcert) {
      applyConcertPalette(activeRecognitionConcert.band, activeRecognitionConcert.date);
      if (isEnabled('exif-visual-character')) {
        applyExifVisualCharacter(activeRecognitionConcert);
      } else {
        resetExifVisualCharacter();
      }
    } else {
      resetToDeadSignal();
      resetExifVisualCharacter();
    }
    return () => {
      resetToDeadSignal();
      resetExifVisualCharacter();
    };
  }, [activeRecognitionConcert, isEnabled]);

  useEffect(() => {
    if (showSecretSettings) {
      setIsDebugOverlayVisible(false);
    }
  }, [showSecretSettings]);

  // Module: Audio Playback
  const { play, pause, stop, preload, crossfade, isPlaying, progress, playbackError } =
    useAudioPlayback({
      volume: 1.0,
      maxDurationMs: isDemoUser() ? 30_000 : undefined,
      onSongEnd: () => {
        if (userPausedRef.current) return;
        const nextSong = getNextTrackAfterForwardAdvance();
        if (nextSong?.audioFile && playRef.current) {
          playRef.current(nextSong.audioFile);
          setActiveConcert(nextSong);
        }
      },
    });

  // Effect: Song-Progress Scan Lines
  // As progress approaches 1, restore scan lines with visible intensity (max +0.45 opacity).
  // Directly modulates --crt-opacity on the root element while the matched-state CSS
  // (html[data-state='matched'] in src/index.css) sets its baseline to 0; when this
  // effect cleans up, control returns to the CSS-driven state machine.
  // Gated on activeRecognitionConcert (not activeConcert) so it only runs in matched
  // state — activeConcert persists while audio plays even after recognition resets.
  useEffect(() => {
    if (!isEnabled('song-progress-scanlines') || !isPlaying || !activeRecognitionConcert) {
      document.documentElement.style.removeProperty('--crt-opacity');
      return;
    }
    // Exponential curve: near-invisible for first ~60%, rises steeply in final ~40%.
    // At 75% → 0.32, 90% → 0.55, 100% → 0.75 — clearly visible as the song closes.
    document.documentElement.style.setProperty(
      '--crt-opacity',
      (Math.pow(progress, 2.5) * 0.75).toFixed(3)
    );
    return () => {
      document.documentElement.style.removeProperty('--crt-opacity');
    };
  }, [progress, isPlaying, activeRecognitionConcert, isEnabled]);

  // Keep playRef in sync so onSongEnd (stable closure) can call the latest play fn
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  // Preload audio as soon as a candidate is being debounced — before full confirmation.
  // This hides the 180 ms recognition window: by the time the match is confirmed the
  // Howl is already loaded and play() fires with no network wait.
  useEffect(() => {
    if (!recognizingConcert?.audioFile) {
      return;
    }
    preload(recognizingConcert.audioFile);
  }, [preload, recognizingConcert]);

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

  // Speculatively preload the next playlist track so tapping next has no network wait.
  useEffect(() => {
    if (!isPlaying || !activeConcert) {
      return;
    }
    const playlist = playlistRef.current;
    if (playlist.length <= 1) {
      return;
    }
    const currentIdx = playlist.findIndex((c) => c.id === activeConcert.id);
    if (currentIdx === -1) {
      return;
    }
    const nextIdx = (currentIdx + 1) % playlist.length;
    const nextUrl = playlist[nextIdx]?.audioFile;
    if (nextUrl) {
      preload(nextUrl);
    }
  }, [isPlaying, activeConcert, preload]);

  // Auto-play newly recognized concerts, interrupting any current playback for a new match.
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

    if (!isNewAutoplayConcert) {
      return; // Same image scanned again — don't restart
    }

    if (!autoplayConcert.audioFile) {
      return;
    }

    // Same exact concert as currently active — don't restart (handles close+rescan scenario)
    if (autoplayConcert.id === activeConcertRef.current?.id) {
      return;
    }

    // Same artist: advance to a different track in the existing playlist
    if (autoplayConcert.band === activePlaylistBand) {
      const MAX_ADVANCE_ATTEMPTS = 3;
      let attempts = 0;
      let nextSong = getNextTrackAfterForwardAdvance();

      while (
        attempts < MAX_ADVANCE_ATTEMPTS &&
        nextSong !== null &&
        (!nextSong.audioFile ||
          (activeConcertRef.current &&
            (nextSong.id === activeConcertRef.current.id ||
              nextSong.audioFile === activeConcertRef.current.audioFile)))
      ) {
        attempts += 1;
        nextSong = getNextTrackAfterForwardAdvance();
      }

      // If no valid different playable track found, keep current playback
      if (
        !nextSong?.audioFile ||
        (activeConcertRef.current &&
          (nextSong.id === activeConcertRef.current.id ||
            nextSong.audioFile === activeConcertRef.current.audioFile))
      ) {
        return; // Only current track available for this artist — keep playing
      }

      userPausedRef.current = false;
      if (isPlaying) {
        crossfade(nextSong.audioFile);
      } else {
        play(nextSong.audioFile);
      }
      setActiveConcert(nextSong);
      return;
    }

    // New artist: build a shuffled playlist and crossfade/play the first track
    const firstSong = startPlaylistForConcert(autoplayConcert);
    if (!firstSong) {
      return;
    }

    userPausedRef.current = false;
    if (isPlaying) {
      crossfade(firstSong.audioFile);
    } else {
      play(firstSong.audioFile);
    }
    setActiveConcert(firstSong);
  }, [
    isActive,
    activeRecognitionConcert,
    isPlaying,
    play,
    crossfade,
    activePlaylistBand,
    startPlaylistForConcert,
    getNextTrackAfterForwardAdvance,
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

  // Keep the screen on while the camera experience is active.
  // The OS automatically releases wake locks when the document is hidden, so
  // re-acquire on visibilitychange → visible if the user switches back.
  useEffect(() => {
    if (!isActive || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = () => {
      void navigator.wakeLock
        .request('screen')
        .then((s) => {
          sentinel = s;
        })
        .catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [isActive]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
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

  const restoreDialogFocus = useCallback(
    (elementToRestore: HTMLElement | null, fallbackFocusTarget?: HTMLElement | null) => {
      if (
        elementToRestore &&
        elementToRestore !== document.body &&
        document.contains(elementToRestore)
      ) {
        elementToRestore.focus();
      } else if (fallbackFocusTarget && document.contains(fallbackFocusTarget)) {
        fallbackFocusTarget.focus();
      }
    },
    []
  );

  const shutdownExperience = useCallback(() => {
    clearLongPressTimer();
    userPausedRef.current = true;
    stop();
    setIsActive(false);
    setIsConcertInfoVisible(false);
    setHasScannedPhotoLoadFailed(false);
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
    setIsDownloadPromptVisible(false);
  }, [clearLongPressTimer, shouldShowScannedPhoto]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  useEffect(() => {
    if (!isDownloadPromptVisible) {
      return;
    }

    downloadPreviousFocusRef.current = document.activeElement as HTMLElement | null;
    downloadCancelButtonRef.current?.focus();

    const fallbackFocusTarget = scanAnotherButtonRef.current;
    return () => {
      restoreDialogFocus(downloadPreviousFocusRef.current, fallbackFocusTarget);
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

  const startLongPress = useCallback(() => {
    clearLongPressTimer();

    longPressTimerRef.current = window.setTimeout(() => {
      setIsDownloadPromptVisible(true);
    }, LONG_PRESS_DURATION_MS);
  }, [clearLongPressTimer]);

  const handleMatchedPhotoMouseDown = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
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

  const canNavigatePlaylist = playlistRef.current.length > 1;
  const shouldShowBottomPlayer = Boolean(activeConcert);

  // Mirror handleTogglePlayback's target selection so the strip always names the concert
  // that a tap will actually play (activeRecognitionConcert when paused with a new match,
  // otherwise activeConcert).
  const stripConcert =
    !isPlaying && activeRecognitionConcert ? activeRecognitionConcert : activeConcert;

  // Signal strip — two-row audio player
  const audioControls = shouldShowBottomPlayer ? (
    <section className={styles.signalStrip} aria-label="Now playing controls">
      <div
        className={styles.signalProgress}
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Song progress"
      >
        <div className={styles.signalProgressFill} style={{ width: `${progress * 100}%` }} />
      </div>
      <div className={styles.signalStripTop}>
        {stripConcert?.albumCoverUrl ? (
          <img
            src={stripConcert.albumCoverUrl}
            alt=""
            className={styles.signalArt}
            aria-hidden="true"
          />
        ) : null}
        <div className={styles.signalMeta}>
          {stripConcert?.songTitle ? (
            <span className={styles.signalTitle}>{stripConcert.songTitle}</span>
          ) : null}
          <span className={styles.signalBand}>{stripConcert?.band ?? ''}</span>
        </div>
        <button
          type="button"
          className={`${styles.signalPlayBtn} ${isPlaying ? styles.signalPlayBtnPlaying : ''}`}
          onClick={handleTogglePlayback}
          aria-label={
            isPlaying ? `Pause ${stripConcert?.band ?? ''}` : `Play ${stripConcert?.band ?? ''}`
          }
        >
          <span className={styles.signalPlayBtnIcon}>
            {isPlaying ? (
              <svg
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="5" y="3" width="4" height="18" rx="1" />
                <rect x="15" y="3" width="4" height="18" rx="1" />
              </svg>
            ) : (
              <svg
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon points="5,3 21,12 5,21" />
              </svg>
            )}
          </span>
        </button>
        {canNavigatePlaylist ? (
          <button
            type="button"
            className={styles.signalNextBtn}
            onClick={handleNextTrack}
            aria-label="Next track"
          >
            <svg
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <polygon points="5,4 17,12 5,20" />
              <rect x="19" y="4" width="2" height="16" rx="1" />
            </svg>
          </button>
        ) : null}
      </div>
      {playbackError !== null && (
        <p className={styles.signalError} role="alert">
          {playbackError}
        </p>
      )}
    </section>
  ) : null;

  // Camera view — live feed or matched photo with concert overlay
  const cameraView = shouldShowScannedPhoto ? (
    <div className={styles.scannedPhotoFrame} aria-label="Matched photo preview">
      <img
        src={scannedPhotoUrl}
        alt={`${infoConcert?.band ?? 'Matched concert'} scanned photograph`}
        className={styles.scannedPhotoImage}
        loading="eager"
        draggable={false}
        onError={() => setHasScannedPhotoLoadFailed(true)}
        onTouchStart={startLongPress}
        onTouchEnd={clearLongPressTimer}
        onTouchCancel={clearLongPressTimer}
        onTouchMove={clearLongPressTimer}
        onMouseDown={handleMatchedPhotoMouseDown}
        onMouseUp={clearLongPressTimer}
        onMouseLeave={clearLongPressTimer}
        onMouseMove={clearLongPressTimer}
        onContextMenu={(event) => event.preventDefault()}
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
      {hasDataError && !isActive && (
        <div className={styles.dataErrorBanner} role="alert">
          Unable to load gallery data. Check your connection and refresh.
        </div>
      )}
      <GalleryLayout
        isActive={isActive}
        cameraView={cameraView}
        onActivate={handleActivate}
        onSettingsClick={() => setShowSecretSettings(true)}
        audioControls={audioControls}
        isMatchedPhoto={shouldShowScannedPhoto}
        aboveCameraSlot={
          infoConcert ? (
            <div className={styles.matchedPhotoHeader}>
              <InfoDisplay concert={infoConcert} isVisible={true} />
            </div>
          ) : null
        }
        belowCameraSlot={
          infoConcert ? (
            <div className={styles.scanAnotherRow}>
              <button
                ref={scanAnotherButtonRef}
                type="button"
                className={styles.closePhotoButton}
                onClick={() => handleCloseConcertInfo(infoConcert)}
                aria-label="Close concert view and scan a new photo"
              >
                ↩ scan another
              </button>
            </div>
          ) : null
        }
      />
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
            onForceMatch={handleForceMatch}
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
            recommendations={recognitionRecommendations}
            onReset={resetRecognition}
            onVisibilityChange={setIsDebugOverlayVisible}
            testAudioUrl={testAudioUrl}
          />
        </Suspense>
      )}
      {import.meta.env.DEV && <DevFakeCameraBadge />}
    </>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[App] Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '2rem',
            color: '#d4892a',
            fontFamily: 'monospace',
            textAlign: 'center',
          }}
        >
          <p>Something went wrong. Please refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
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
    return (
      <AppErrorBoundary>
        <AppContent />
      </AppErrorBoundary>
    );
  }

  const handleUnlockSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedInput = passcodeInput.trim();
    const isGallery = gateConfig.passcode.length > 0 && trimmedInput === gateConfig.passcode;
    const isDemo = gateConfig.demoPasscode.length > 0 && trimmedInput === gateConfig.demoPasscode;

    if (!isGallery && !isDemo) {
      setPasscodeError('Incorrect code. Please try again.');
      return;
    }

    const sessionMs = isDemo ? gateConfig.demoSessionMs : gateConfig.sessionMs;
    setUserType(isDemo ? 'demo' : 'gallery');

    try {
      window.localStorage.setItem(ACCESS_STORAGE_KEY, `${Date.now() + sessionMs}`);
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
