/**
 * Photo Signal App - Modular Architecture
 *
 * This is the orchestrator that wires together independent modules.
 * Each module has a single responsibility and clear contract.
 *
 * Modules can be developed in parallel by different AI agents
 * without conflicts or coupling.
 */

import { lazy, Suspense, useEffect, useState, useRef } from 'react';
import { useCameraAccess } from './modules/camera-access';
import { useMotionDetection } from './modules/motion-detection';
import {
  usePhotoRecognition,
  FrameQualityIndicator,
  GuidanceMessage,
  TelemetryExport,
} from './modules/photo-recognition';
import { useAudioPlayback } from './modules/audio-playback';
import { CameraView } from './modules/camera-view';
import { InfoDisplay } from './modules/concert-info';
import { GalleryLayout } from './modules/gallery-layout';
import type { Concert } from './types';
import type {
  RecognitionTelemetry,
  SwitchDecisionTelemetry,
} from './modules/photo-recognition/types';
import { useTripleTap, useFeatureFlags, useCustomSettings } from './modules/secret-settings';

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
const createEmptySwitchDecisionTelemetry = (): SwitchDecisionTelemetry => ({
  shownCount: 0,
  confirmCount: 0,
  dismissCount: 0,
  decisionLatenciesMs: [],
  averageDecisionLatencyMs: null,
  lastDecisionLatencyMs: null,
  lastPromptSnapshot: {
    activeConcertId: null,
    candidateConcertId: null,
    confidence: null,
    margin: null,
    shownAt: null,
  },
});

const recordSwitchDecisionLatency = (
  switchDecision: SwitchDecisionTelemetry,
  promptShownAt: number | null
): void => {
  if (promptShownAt === null) {
    return;
  }

  const decisionLatencyMs = Math.max(Date.now() - promptShownAt, 0);
  switchDecision.decisionLatenciesMs.push(decisionLatencyMs);
  switchDecision.lastDecisionLatencyMs = decisionLatencyMs;
  switchDecision.averageDecisionLatencyMs =
    switchDecision.decisionLatenciesMs.reduce((total, value) => total + value, 0) /
    switchDecision.decisionLatenciesMs.length;
};

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

const coerceNumberSetting = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
};

function AppContent() {
  // State for landing view vs. active camera view
  const [isActive, setIsActive] = useState(false);

  // State for secret settings menu
  const [showSecretSettings, setShowSecretSettings] = useState(false);

  // Track whether debug overlay is currently visible/expanded
  const [isDebugOverlayVisible, setIsDebugOverlayVisible] = useState(true);

  // Track audio that is currently playing so we can keep music alive between scans
  const [activeConcert, setActiveConcert] = useState<Concert | null>(null);
  const [pendingSwitchConcert, setPendingSwitchConcert] = useState<Concert | null>(null);
  const [dismissedSwitchConcertId, setDismissedSwitchConcertId] = useState<number | null>(null);

  // Ref to store auto-reset timer ID for test mode
  const autoResetTimerRef = useRef<number | null>(null);
  const previousRecognizedIdRef = useRef<number | null>(null);
  const switchDecisionTelemetryRef = useRef<SwitchDecisionTelemetry>(
    createEmptySwitchDecisionTelemetry()
  );
  const lastPromptConcertIdRef = useRef<number | null>(null);
  const promptShownAtRef = useRef<number | null>(null);

  // Module: Feature Flags & Custom Settings
  const { isEnabled } = useFeatureFlags();
  const { getSetting, settings } = useCustomSettings();
  const isTestModeEnabled = isEnabled('test-mode');

  // Module: Secret Settings - Triple-tap detection
  useTripleTap({
    onTripleTap: () => {
      setShowSecretSettings(true);
    },
  });

  // Apply theme changes
  useEffect(() => {
    const themeMode = getSetting<string>('theme-mode') ?? 'dark';
    const uiStyle = getSetting<string>('ui-style') ?? 'modern';

    // Apply theme mode (light/dark)
    document.documentElement.setAttribute('data-theme', themeMode);

    // Apply UI style (modern/classic)
    document.documentElement.setAttribute('data-ui-style', uiStyle);
  }, [getSetting, settings]);

  // Module: Camera Access (only initialize when active)
  const { stream, error, hasPermission, retry } = useCameraAccess({
    autoStart: isActive,
  });

  // Module: Motion Detection (paused when secret menu is open)
  const { isMoving } = useMotionDetection(stream, {
    sensitivity: 50,
    checkInterval: 500,
    enabled: !showSecretSettings,
  });

  const rawRecognitionDelay = getSetting<number>('recognition-delay');
  const recognitionDelayValue =
    rawRecognitionDelay === undefined || rawRecognitionDelay === 3000
      ? 1000
      : coerceNumberSetting(rawRecognitionDelay, 1000);
  const defaultSimilarityThreshold = 12;
  const rawSimilarityThreshold = getSetting<number>('similarity-threshold');
  const similarityThresholdValue = coerceNumberSetting(
    rawSimilarityThreshold === undefined ||
      rawSimilarityThreshold === 40 ||
      rawSimilarityThreshold === 24
      ? defaultSimilarityThreshold
      : rawSimilarityThreshold,
    defaultSimilarityThreshold
  );
  const rawFrameScanInterval = getSetting<number>('recognition-check-interval');
  const frameScanIntervalValue =
    rawFrameScanInterval === undefined || rawFrameScanInterval === 1000
      ? 250
      : coerceNumberSetting(rawFrameScanInterval, 250);
  const sharpnessThresholdValue = coerceNumberSetting(
    getSetting<number>('sharpness-threshold'),
    100
  );
  const glareThresholdValue = coerceNumberSetting(getSetting<number>('glare-threshold'), 250);
  const glarePercentageThresholdValue = coerceNumberSetting(
    getSetting<number>('glare-percentage-threshold'),
    20
  );
  const rectangleDetectionConfidenceThresholdValue = coerceNumberSetting(
    getSetting<number>('rectangle-detection-confidence-threshold'),
    0.3 // Reduced from 0.6 to 0.3 for better real-world detection
  );

  // Module: Photo Recognition (paused when secret menu is open)
  const {
    recognizedConcert,
    reset: resetRecognition,
    debugInfo,
    isRecognizing,
    frameQuality,
    activeGuidance,
    detectedRectangle,
    rectangleConfidence,
  } = usePhotoRecognition(stream, {
    recognitionDelay: recognitionDelayValue,
    similarityThreshold: similarityThresholdValue,
    checkInterval: frameScanIntervalValue,
    sharpnessThreshold: sharpnessThresholdValue,
    glareThreshold: glareThresholdValue,
    glarePercentageThreshold: glarePercentageThresholdValue,
    enableDebugInfo: isDebugOverlayVisible,
    aspectRatio: 'auto',
    enableRectangleDetection: isEnabled('rectangle-detection'),
    rectangleConfidenceThreshold: rectangleDetectionConfidenceThresholdValue,
    continuousRecognition: true,
    switchRecognitionDelayMultiplier: 1.8,
    switchDistanceThreshold: 8,
    enabled: !showSecretSettings,
  });

  useEffect(() => {
    if (showSecretSettings) {
      setIsDebugOverlayVisible(false);
    }
  }, [showSecretSettings]);

  // Module: Audio Playback
  const {
    play,
    pause,
    preload,
    fadeOut,
    crossfade,
    isPlaying,
    progress,
    playbackError,
    clearPlaybackError,
  } = useAudioPlayback({
    volume: 0.8,
    fadeTime: 1000,
  });

  // Begin streaming the recognized track immediately so playback feels instant
  useEffect(() => {
    if (!recognizedConcert) {
      return;
    }

    const selectedAudioUrl = recognizedConcert.audioFile;

    if (!selectedAudioUrl) {
      return;
    }

    preload(selectedAudioUrl);
  }, [preload, recognizedConcert]);

  // Auto-play newly recognized concerts whenever nothing is currently playing.
  useEffect(() => {
    if (!recognizedConcert) {
      previousRecognizedIdRef.current = null;
      return;
    }

    if (!isActive) {
      return;
    }

    const isNewRecognition = previousRecognizedIdRef.current !== recognizedConcert.id;
    previousRecognizedIdRef.current = recognizedConcert.id;

    if (!isNewRecognition || isPlaying) {
      return;
    }

    const selectedAudioUrl = recognizedConcert.audioFile;
    if (!selectedAudioUrl) {
      return;
    }

    play(selectedAudioUrl);
    setActiveConcert(recognizedConcert);
    setPendingSwitchConcert(null);
    setDismissedSwitchConcertId(null);
  }, [isActive, recognizedConcert, isPlaying, play]);

  // Track a switch candidate while music is already playing.
  useEffect(() => {
    if (!recognizedConcert || !activeConcert || !isPlaying) {
      setPendingSwitchConcert(null);
      return;
    }

    if (activeGuidance === 'ambiguous-match') {
      setPendingSwitchConcert(null);
      return;
    }

    if (recognizedConcert.id === activeConcert.id) {
      setPendingSwitchConcert(null);
      setDismissedSwitchConcertId(null);
      return;
    }

    if (dismissedSwitchConcertId === recognizedConcert.id) {
      setPendingSwitchConcert(null);
      return;
    }

    setPendingSwitchConcert(recognizedConcert);
  }, [recognizedConcert, activeConcert, isPlaying, dismissedSwitchConcertId, activeGuidance]);

  useEffect(() => {
    if (!pendingSwitchConcert) {
      lastPromptConcertIdRef.current = null;
      promptShownAtRef.current = null;
      return;
    }

    if (lastPromptConcertIdRef.current === pendingSwitchConcert.id) {
      return;
    }

    const shownAt = Date.now();
    const switchDecision = switchDecisionTelemetryRef.current;
    switchDecision.shownCount += 1;
    switchDecision.lastPromptSnapshot = {
      activeConcertId: activeConcert?.id ?? null,
      candidateConcertId: pendingSwitchConcert.id,
      confidence: debugInfo?.bestMatch?.similarity ?? null,
      margin: debugInfo?.bestMatchMargin ?? null,
      shownAt,
    };
    promptShownAtRef.current = shownAt;
    lastPromptConcertIdRef.current = pendingSwitchConcert.id;
  }, [activeConcert, debugInfo, pendingSwitchConcert]);

  useEffect(() => {
    if (!isTestModeEnabled || !recognizedConcert) {
      return;
    }

    const AUTO_RESET_DELAY_MS = 4000;
    const timerId = window.setTimeout(() => {
      fadeOut();
      setActiveConcert(null);
      resetRecognition();
    }, AUTO_RESET_DELAY_MS);

    // Store timer ID in ref so motion detection can clear it
    autoResetTimerRef.current = timerId;

    return () => {
      window.clearTimeout(timerId);
      autoResetTimerRef.current = null;
    };
  }, [isTestModeEnabled, recognizedConcert, fadeOut, resetRecognition]);

  // Clear dismissed switch preference when user starts moving to a new area.
  const previousMovementRef = useRef(false);
  useEffect(() => {
    if (isMoving && !previousMovementRef.current && activeConcert) {
      if (autoResetTimerRef.current !== null) {
        window.clearTimeout(autoResetTimerRef.current);
        autoResetTimerRef.current = null;
      }

      setDismissedSwitchConcertId(null);
    }

    previousMovementRef.current = isMoving;
  }, [isMoving, activeConcert]);

  const handleTogglePlayback = () => {
    const playbackTargetConcert =
      !isPlaying && recognizedConcert ? recognizedConcert : activeConcert;

    if (!playbackTargetConcert) {
      return;
    }

    const selectedAudioUrl = playbackTargetConcert.audioFile;
    if (!selectedAudioUrl) {
      return;
    }

    if (isPlaying) {
      pause();
      return;
    }

    clearPlaybackError();
    play(selectedAudioUrl);
    setActiveConcert(playbackTargetConcert);
    setPendingSwitchConcert(null);
    setDismissedSwitchConcertId(null);
  };

  const handleConfirmSwitch = () => {
    if (!pendingSwitchConcert) {
      return;
    }

    const selectedAudioUrl = pendingSwitchConcert.audioFile;
    if (!selectedAudioUrl) {
      return;
    }

    const switchDecision = switchDecisionTelemetryRef.current;
    switchDecision.confirmCount += 1;
    recordSwitchDecisionLatency(switchDecision, promptShownAtRef.current);
    promptShownAtRef.current = null;
    lastPromptConcertIdRef.current = null;

    if (activeConcert && isPlaying) {
      crossfade(selectedAudioUrl);
    } else {
      clearPlaybackError();
      play(selectedAudioUrl);
    }

    setActiveConcert(pendingSwitchConcert);
    setPendingSwitchConcert(null);
    setDismissedSwitchConcertId(null);
  };

  const handleKeepCurrentTrack = () => {
    if (!pendingSwitchConcert) {
      return;
    }

    const switchDecision = switchDecisionTelemetryRef.current;
    switchDecision.dismissCount += 1;
    recordSwitchDecisionLatency(switchDecision, promptShownAtRef.current);
    promptShownAtRef.current = null;
    lastPromptConcertIdRef.current = null;

    setDismissedSwitchConcertId(pendingSwitchConcert.id);
    setPendingSwitchConcert(null);
  };

  const handlePauseCurrent = () => {
    pause();
  };

  // Handle activation from landing view
  const handleActivate = () => {
    setIsActive(true);
  };

  const infoConcert = pendingSwitchConcert ?? recognizedConcert ?? activeConcert;
  const isInfoActive = !!(infoConcert && activeConcert && activeConcert.id === infoConcert.id);
  const showSwitchPrompt = !!pendingSwitchConcert;

  const primaryActionLabel = isPlaying ? (isInfoActive ? 'Pause' : 'Pause Current') : 'Play';

  const statusLabel = playbackError
    ? 'Playback Error'
    : isInfoActive && isPlaying
      ? 'Now Playing'
      : showSwitchPrompt
        ? 'New Photo Found'
        : recognizedConcert && !isInfoActive
          ? 'Now Viewing'
          : isInfoActive
            ? 'Paused'
            : 'Now Viewing';

  const promptText = playbackError
    ? playbackError.toLowerCase().includes(RETRY_HINT_TEXT)
      ? playbackError
      : `${playbackError} Check stream access and tap Play to retry.`
    : showSwitchPrompt
      ? `Now playing ${activeConcert?.band}. Switch to ${pendingSwitchConcert?.band}?`
      : recognizedConcert
        ? 'Song started automatically. Music keeps playing until you pause.'
        : activeConcert
          ? 'Music will keep playing until you pause.'
          : 'Point your camera at a photo to get started.';

  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const progressColor = `hsl(${Math.round(210 + clampedProgress * 150)}, 80%, 70%)`;
  const nowPlayingLine = activeConcert
    ? `ghost dial locked on ${activeConcert.band} · ${Math.round(progress * 100)}% through`
    : isPlaying
      ? 'ghost dial humming, no band tagged'
      : 'receiver idle — lift camera to wake it';

  const actions =
    infoConcert && (isPlaying || recognizedConcert || activeConcert) ? (
      <>
        {showSwitchPrompt ? (
          <div>
            <button
              type="button"
              onClick={handleConfirmSwitch}
              aria-label={`Switch to ${pendingSwitchConcert?.band}`}
            >
              Switch to {pendingSwitchConcert?.band}
            </button>
            <button
              type="button"
              data-variant="secondary"
              onClick={handleKeepCurrentTrack}
              aria-label="Keep current track"
            >
              Keep Current
            </button>
            <button
              type="button"
              data-variant="secondary"
              onClick={handlePauseCurrent}
              aria-label="Pause currently playing track"
            >
              Pause Current
            </button>
          </div>
        ) : (
          <div>
            <button type="button" onClick={handleTogglePlayback} aria-label={primaryActionLabel}>
              {primaryActionLabel}
            </button>
          </div>
        )}
        {showSwitchPrompt ? (
          <p>
            Now playing: {activeConcert?.band}. Confirm to switch to {pendingSwitchConcert?.band}.
          </p>
        ) : null}
        {activeConcert && isInfoActive && !isPlaying ? <p>Paused — tap play to resume.</p> : null}
      </>
    ) : null;

  // Render camera view
  const displayedConcert = recognizedConcert ?? activeConcert;

  const cameraView = (
    <CameraView
      stream={stream}
      error={error}
      hasPermission={hasPermission}
      onRetry={retry}
      grayscale={isEnabled('grayscale-mode')}
      concertInfo={displayedConcert}
      showConcertOverlay={false}
      detectedRectangle={detectedRectangle}
      rectangleConfidence={rectangleConfidence}
      rectangleDetectionConfidenceThreshold={rectangleDetectionConfidenceThresholdValue}
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
      nowPlayingLine={nowPlayingLine}
      progressValue={progress}
      progressColor={progressColor}
      actions={actions}
    />
  );

  // Render frame quality indicator (only when camera is active and no concert recognized)
  const frameQualityIndicator = isActive && stream && !recognizedConcert && (
    <FrameQualityIndicator frameQuality={frameQuality} />
  );

  // Render guidance message whenever active guidance exists during camera session
  const guidanceMessage = isActive && stream && activeGuidance !== 'none' && (
    <GuidanceMessage guidanceType={activeGuidance} />
  );
  const telemetryForExport: RecognitionTelemetry | null = debugInfo?.telemetry
    ? {
        ...debugInfo.telemetry,
        switchDecision: {
          ...switchDecisionTelemetryRef.current,
          decisionLatenciesMs: [...switchDecisionTelemetryRef.current.decisionLatenciesMs],
          lastPromptSnapshot: { ...switchDecisionTelemetryRef.current.lastPromptSnapshot },
        },
      }
    : null;

  return (
    <>
      <GalleryLayout
        isActive={isActive}
        cameraView={cameraView}
        infoDisplay={infoDisplay}
        onActivate={handleActivate}
      />
      <button
        type="button"
        className="floating-settings-button"
        onClick={() => setShowSecretSettings(true)}
        aria-label="Open settings"
      >
        Settings
      </button>
      {frameQualityIndicator}
      {guidanceMessage}
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
      {!showSecretSettings && (
        <Suspense fallback={null}>
          <DebugOverlay
            enabled
            isTestMode={isTestModeEnabled}
            recognizedConcert={recognizedConcert}
            isRecognizing={isRecognizing}
            threshold={similarityThresholdValue}
            debugInfo={debugInfo}
            onReset={resetRecognition}
            onVisibilityChange={setIsDebugOverlayVisible}
          />
        </Suspense>
      )}
      {isTestModeEnabled && !showSecretSettings && telemetryForExport && (
        <TelemetryExport telemetry={telemetryForExport} />
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
