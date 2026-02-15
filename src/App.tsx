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
import { useTripleTap, useFeatureFlags, useCustomSettings } from './modules/secret-settings';

const SecretSettings = lazy(async () => {
  const module = await import('./modules/secret-settings/SecretSettings');
  return { default: module.SecretSettings };
});

const DebugOverlay = lazy(async () => {
  const module = await import('./modules/debug-overlay');
  return { default: module.DebugOverlay };
});

const coerceNumberSetting = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
};

function App() {
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
  const { play, pause, preload, fadeOut, crossfade, isPlaying, progress } = useAudioPlayback({
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

  // Auto-play the first recognized concert after camera activation.
  useEffect(() => {
    if (!isActive || !recognizedConcert || activeConcert) {
      return;
    }

    const selectedAudioUrl = recognizedConcert.audioFile;
    if (!selectedAudioUrl) {
      return;
    }

    play(selectedAudioUrl);
    setActiveConcert(recognizedConcert);
  }, [isActive, recognizedConcert, activeConcert, play]);

  // Track a switch candidate while music is already playing.
  useEffect(() => {
    if (!recognizedConcert || !activeConcert || !isPlaying) {
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
  }, [recognizedConcert, activeConcert, isPlaying, dismissedSwitchConcertId]);

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
    if (!activeConcert) {
      return;
    }

    const selectedAudioUrl = activeConcert.audioFile;
    if (!selectedAudioUrl) {
      return;
    }

    if (isPlaying) {
      pause();
      return;
    }

    play(selectedAudioUrl);
    setActiveConcert(activeConcert);
  };

  const handleConfirmSwitch = () => {
    if (!pendingSwitchConcert) {
      return;
    }

    const selectedAudioUrl = pendingSwitchConcert.audioFile;
    if (!selectedAudioUrl) {
      return;
    }

    if (activeConcert && isPlaying) {
      crossfade(selectedAudioUrl);
    } else {
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

  const primaryActionLabel = (() => {
    if (!activeConcert) {
      return 'Play';
    }

    if (isInfoActive) {
      return isPlaying ? 'Pause' : 'Play';
    }

    return isPlaying ? 'Pause Current' : 'Play Current';
  })();

  const statusLabel =
    isInfoActive && isPlaying
      ? 'Now Playing'
      : showSwitchPrompt
        ? 'New Photo Found'
        : recognizedConcert && !isInfoActive
          ? 'Now Viewing'
          : isInfoActive
            ? 'Paused'
            : 'Now Viewing';

  const promptText = showSwitchPrompt
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

  // Render guidance message (only when camera is active and no concert recognized)
  const guidanceMessage = isActive && stream && !recognizedConcert && (
    <GuidanceMessage guidanceType={activeGuidance} />
  );

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
      {isTestModeEnabled && !showSecretSettings && debugInfo?.telemetry && (
        <TelemetryExport telemetry={debugInfo.telemetry} />
      )}
    </>
  );
}

export default App;
