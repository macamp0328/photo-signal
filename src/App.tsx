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
import type { AspectRatio, Concert } from './types';
import {
  useTripleTap,
  useFeatureFlags,
  useCustomSettings,
  useRetroSounds,
} from './modules/secret-settings';
import './index.css';

const SecretSettings = lazy(async () => {
  const module = await import('./modules/secret-settings/SecretSettings');
  return { default: module.SecretSettings };
});

const PsychedelicEffect = lazy(async () => {
  const module = await import('./modules/secret-settings/PsychedelicEffect');
  return { default: module.PsychedelicEffect };
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

  // State for aspect ratio
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:2');

  // Track audio that is currently playing so we can keep music alive between scans
  const [activeConcert, setActiveConcert] = useState<Concert | null>(null);

  // Ref to store auto-reset timer ID for test mode
  const autoResetTimerRef = useRef<number | null>(null);

  // Module: Feature Flags & Custom Settings
  const { isEnabled } = useFeatureFlags();
  const { getSetting, settings } = useCustomSettings();
  const isTestModeEnabled = isEnabled('test-mode');

  // Module: Retro Sounds
  const { playRandomSound } = useRetroSounds(isEnabled('retro-sounds'));

  // Module: Secret Settings - Triple-tap detection
  useTripleTap({
    onTripleTap: () => {
      setShowSecretSettings(true);
      // Play sound when opening secret menu
      playRandomSound();
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

  // Module: Motion Detection
  const { isMoving } = useMotionDetection(stream, {
    sensitivity: 50,
    checkInterval: 500,
  });

  const recognitionDelayValue = coerceNumberSetting(getSetting<number>('recognition-delay'), 3000);
  const similarityThresholdValue = coerceNumberSetting(
    getSetting<number>('similarity-threshold'),
    40
  );
  const frameScanIntervalValue = coerceNumberSetting(
    getSetting<number>('recognition-check-interval'),
    1000
  );
  const sharpnessThresholdValue = coerceNumberSetting(
    getSetting<number>('sharpness-threshold'),
    100
  );
  const glareThresholdValue = coerceNumberSetting(getSetting<number>('glare-threshold'), 250);
  const glarePercentageThresholdValue = coerceNumberSetting(
    getSetting<number>('glare-percentage-threshold'),
    20
  );
  const hashAlgorithmSetting = getSetting<'dhash' | 'phash'>('hash-algorithm');
  const hashAlgorithmValue = hashAlgorithmSetting === 'phash' ? 'phash' : 'dhash';

  // Module: Photo Recognition
  const {
    recognizedConcert,
    reset: resetRecognition,
    debugInfo,
    isRecognizing,
    frameQuality,
    activeGuidance,
  } = usePhotoRecognition(stream, {
    recognitionDelay: recognitionDelayValue,
    similarityThreshold: similarityThresholdValue,
    checkInterval: frameScanIntervalValue,
    sharpnessThreshold: sharpnessThresholdValue,
    glareThreshold: glareThresholdValue,
    glarePercentageThreshold: glarePercentageThresholdValue,
    enableDebugInfo: isTestModeEnabled,
    aspectRatio: aspectRatio,
    hashAlgorithm: hashAlgorithmValue,
    enableMultiScale: isEnabled('multi-scale-recognition'),
  });

  // Module: Audio Playback
  const { play, fadeOut, crossfade, isPlaying } = useAudioPlayback({
    volume: 0.8,
    fadeTime: 1000,
  });

  // Orchestration Logic
  // Play audio when photo is recognized
  useEffect(() => {
    if (!recognizedConcert) {
      return;
    }

    const isSameConcert = activeConcert?.id === recognizedConcert.id;

    if (!activeConcert) {
      console.log('Photo recognized:', recognizedConcert.band);
      play(recognizedConcert.audioFile, recognizedConcert.audioFileFallback);
      setActiveConcert(recognizedConcert);
      playRandomSound();
      return;
    }

    if (isSameConcert) {
      return;
    }

    console.log('Photo changed, crossfading to:', recognizedConcert.band);
    crossfade(recognizedConcert.audioFile, undefined, recognizedConcert.audioFileFallback);
    setActiveConcert(recognizedConcert);
    playRandomSound();
  }, [recognizedConcert, activeConcert, play, crossfade, playRandomSound]);

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

  // Handle activation from landing view
  const handleActivate = () => {
    setIsActive(true);
    // Play sound on activation
    playRandomSound();
  };

  // Render camera view
  const displayedConcert = activeConcert ?? recognizedConcert;

  const cameraView = (
    <CameraView
      stream={stream}
      error={error}
      hasPermission={hasPermission}
      onRetry={retry}
      aspectRatio={aspectRatio}
      onAspectRatioToggle={() => setAspectRatio((prev) => (prev === '3:2' ? '2:3' : '3:2'))}
      grayscale={isEnabled('grayscale-mode')}
      concertInfo={displayedConcert}
      showConcertOverlay={!!displayedConcert && isPlaying}
    />
  );

  // Render info display (not shown since showInfoSection is false, concert info is in camera overlay)
  const infoDisplay = (
    <InfoDisplay concert={displayedConcert} isVisible={!!displayedConcert && isPlaying} />
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
        showInfoSection={false}
      />
      {frameQualityIndicator}
      {guidanceMessage}
      {showSecretSettings && (
        <Suspense fallback={null}>
          <SecretSettings
            isVisible={showSecretSettings}
            onClose={() => {
              setShowSecretSettings(false);
              // Play sound when closing secret menu
              playRandomSound();
            }}
          />
        </Suspense>
      )}
      {isEnabled('psychedelic-mode') && (
        <Suspense fallback={null}>
          <PsychedelicEffect enabled={true} />
        </Suspense>
      )}
      {isTestModeEnabled && (
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
      {isTestModeEnabled && debugInfo?.telemetry && (
        <TelemetryExport telemetry={debugInfo.telemetry} />
      )}
    </>
  );
}

export default App;
