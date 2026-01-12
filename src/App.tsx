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

  // Track audio that is currently playing so we can keep music alive between scans
  const [activeConcert, setActiveConcert] = useState<Concert | null>(null);

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
  const recognitionModeSetting = getSetting<'perceptual' | 'orb' | 'parallel'>('recognition-mode');
  const recognitionMode =
    recognitionModeSetting === 'orb'
      ? 'orb'
      : recognitionModeSetting === 'parallel'
        ? 'parallel'
        : 'perceptual';
  const hashAlgorithmSetting = getSetting<'dhash' | 'phash'>('hash-algorithm');
  const perceptualAlgorithm = hashAlgorithmSetting === 'phash' ? 'phash' : 'dhash';
  const hashAlgorithmValue =
    recognitionMode === 'orb' || recognitionMode === 'parallel' ? 'orb' : perceptualAlgorithm;
  const defaultSimilarityThreshold =
    hashAlgorithmValue === 'phash' ? 12 : hashAlgorithmValue === 'orb' ? 0 : 24;
  const rawSimilarityThreshold = getSetting<number>('similarity-threshold');
  const similarityThresholdValue = coerceNumberSetting(
    hashAlgorithmValue === 'orb'
      ? 0
      : rawSimilarityThreshold === undefined ||
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
  const orbMaxFeatures = coerceNumberSetting(getSetting<number>('orb-max-features'), 500);
  const orbFastThreshold = coerceNumberSetting(getSetting<number>('orb-fast-threshold'), 20);
  const orbMinMatchCount = coerceNumberSetting(getSetting<number>('orb-min-match-count'), 20);
  const orbMatchRatioThreshold = coerceNumberSetting(
    getSetting<number>('orb-match-ratio-threshold'),
    0.7
  );
  const secondaryHashAlgorithm = hashAlgorithmValue === 'dhash' ? ('phash' as const) : null;
  const secondarySimilarityThreshold = secondaryHashAlgorithm ? 12 : undefined;
  const orbConfig =
    hashAlgorithmValue === 'orb'
      ? {
          maxFeatures: orbMaxFeatures,
          fastThreshold: orbFastThreshold,
          minMatchCount: orbMinMatchCount,
          matchRatioThreshold: orbMatchRatioThreshold,
        }
      : undefined;

  // Parallel recognition settings
  const parallelRecognitionEnabledSetting = getSetting<string>('parallel-recognition-enabled');
  const parallelRecognitionEnabled =
    recognitionMode === 'parallel' || parallelRecognitionEnabledSetting === 'true';
  const parallelDHashWeight = coerceNumberSetting(getSetting<number>('parallel-dhash-weight'), 0.3);
  const parallelPHashWeight = coerceNumberSetting(
    getSetting<number>('parallel-phash-weight'),
    0.35
  );
  const parallelOrbWeight = coerceNumberSetting(getSetting<number>('parallel-orb-weight'), 0.35);
  const parallelMinConfidence = coerceNumberSetting(
    getSetting<number>('parallel-min-confidence'),
    0.6
  );
  const parallelRecognitionConfig = parallelRecognitionEnabled
    ? {
        algorithmWeights: {
          dhash: parallelDHashWeight,
          phash: parallelPHashWeight,
          orb: parallelOrbWeight,
        },
        minConfidenceThreshold: parallelMinConfidence,
      }
    : undefined;

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
    enableDebugInfo: isTestModeEnabled,
    aspectRatio: 'auto',
    hashAlgorithm: hashAlgorithmValue,
    secondaryHashAlgorithm,
    secondarySimilarityThreshold,
    enableMultiScale: isEnabled('multi-scale-recognition'),
    enableRectangleDetection: isEnabled('rectangle-detection'),
    rectangleConfidenceThreshold: rectangleDetectionConfidenceThresholdValue,
    orbConfig,
    enableParallelRecognition: parallelRecognitionEnabled,
    parallelRecognitionConfig,
    enabled: !showSecretSettings,
  });

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

    preload(recognizedConcert.audioFile, recognizedConcert.audioFileFallback);
  }, [preload, recognizedConcert]);

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

  // Restart recognition when movement begins so we can confirm the next photo.
  const previousMovementRef = useRef(false);
  useEffect(() => {
    if (isMoving && !previousMovementRef.current && activeConcert) {
      if (autoResetTimerRef.current !== null) {
        window.clearTimeout(autoResetTimerRef.current);
        autoResetTimerRef.current = null;
      }

      resetRecognition();
    }

    previousMovementRef.current = isMoving;
  }, [isMoving, activeConcert, resetRecognition]);

  const handleTogglePlayback = () => {
    const targetConcert = recognizedConcert ?? activeConcert;

    if (!targetConcert) {
      return;
    }

    const isSameConcert = activeConcert?.id === targetConcert.id;

    if (isSameConcert) {
      if (isPlaying) {
        pause();
        return;
      }

      play(targetConcert.audioFile, targetConcert.audioFileFallback);
      setActiveConcert(targetConcert);
      return;
    }

    if (activeConcert && isPlaying) {
      crossfade(targetConcert.audioFile, undefined, targetConcert.audioFileFallback);
    } else {
      play(targetConcert.audioFile, targetConcert.audioFileFallback);
    }

    setActiveConcert(targetConcert);
  };

  const handlePauseCurrent = () => {
    pause();
  };

  // Handle activation from landing view
  const handleActivate = () => {
    setIsActive(true);
  };

  const infoConcert = recognizedConcert ?? activeConcert;
  const isInfoActive = !!(infoConcert && activeConcert && activeConcert.id === infoConcert.id);
  const showSwitchHint =
    recognizedConcert && activeConcert && recognizedConcert.id !== activeConcert.id && isPlaying;

  const primaryActionLabel = (() => {
    if (!infoConcert) {
      return 'Play';
    }

    if (isInfoActive) {
      return isPlaying ? 'Pause' : 'Play';
    }

    return isPlaying ? `Play ${infoConcert.band}` : 'Play';
  })();

  const statusLabel =
    isInfoActive && isPlaying
      ? 'Now Playing'
      : recognizedConcert && !isInfoActive
        ? 'Now Viewing'
        : isInfoActive
          ? 'Paused'
          : 'Now Viewing';

  const promptText = recognizedConcert
    ? 'Tap play to hear this photo. Music keeps playing until you pause.'
    : activeConcert
      ? 'Music will keep playing until you pause.'
      : 'Point your camera at a photo to get started.';

  const progressColor = `hsl(${Math.round(300 - Math.min(Math.max(progress, 0), 1) * 170)}, 80%, 70%)`;
  const nowPlayingLine = activeConcert
    ? `ghost dial locked on ${activeConcert.band} · ${Math.round(progress * 100)}% through`
    : isPlaying
      ? 'ghost dial humming, no band tagged'
      : 'receiver idle — lift camera to wake it';

  const actions =
    infoConcert && (isPlaying || recognizedConcert || activeConcert) ? (
      <>
        <div>
          <button type="button" onClick={handleTogglePlayback}>
            {primaryActionLabel}
          </button>
          {isPlaying && !isInfoActive ? (
            <button type="button" data-variant="secondary" onClick={handlePauseCurrent}>
              Pause Current
            </button>
          ) : null}
        </div>
        {showSwitchHint ? (
          <p>
            Now playing: {activeConcert?.band}. Tap Play to switch to {recognizedConcert?.band}.
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
            enabled={isTestModeEnabled}
            recognizedConcert={recognizedConcert}
            isRecognizing={isRecognizing}
            threshold={similarityThresholdValue}
            debugInfo={debugInfo}
            onReset={resetRecognition}
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
