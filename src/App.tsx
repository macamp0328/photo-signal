/**
 * Photo Signal App - Modular Architecture
 *
 * This is the orchestrator that wires together independent modules.
 * Each module has a single responsibility and clear contract.
 *
 * Modules can be developed in parallel by different AI agents
 * without conflicts or coupling.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useCameraAccess } from './modules/camera-access';
import { useMotionDetection } from './modules/motion-detection';
import {
  usePhotoRecognition,
  FrameQualityIndicator,
  GuidanceMessage,
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
  SwitchDecisionTelemetry,
  PhotoRecognitionOptions,
} from './modules/photo-recognition/types';
import { useTripleTap, useFeatureFlags } from './modules/secret-settings';
import { dataService } from './services/data-service';

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
const MAX_SWITCH_DECISION_LATENCY_SAMPLES = 200;
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
  if (switchDecision.decisionLatenciesMs.length > MAX_SWITCH_DECISION_LATENCY_SAMPLES) {
    switchDecision.decisionLatenciesMs.shift();
  }

  switchDecision.lastDecisionLatencyMs = decisionLatencyMs;
  const totalDecisions = switchDecision.confirmCount + switchDecision.dismissCount;
  const previousAverage = switchDecision.averageDecisionLatencyMs ?? 0;
  switchDecision.averageDecisionLatencyMs =
    totalDecisions <= 1
      ? decisionLatencyMs
      : previousAverage + (decisionLatencyMs - previousAverage) / totalDecisions;
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
  const capturedTelemetryRef = useRef<RecognitionTelemetry | null>(null);
  // Always up-to-date ref — lets the countdown effect snapshot telemetry without adding
  // telemetryForExport to its dependency array (which would re-schedule the timer every frame).
  const liveTelemetryRef = useRef<RecognitionTelemetry | null>(null);

  // Track audio that is currently playing so we can keep music alive between scans
  const [activeConcert, setActiveConcert] = useState<Concert | null>(null);
  const [pendingSwitchConcert, setPendingSwitchConcert] = useState<Concert | null>(null);
  const [dismissedSwitchConcertId, setDismissedSwitchConcertId] = useState<number | null>(null);

  // Audio test URL for the debug overlay's Test Song button
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);

  const previousRecognizedIdRef = useRef<number | null>(null);
  const switchDecisionTelemetryRef = useRef<SwitchDecisionTelemetry>(
    createEmptySwitchDecisionTelemetry()
  );
  const lastPromptConcertIdRef = useRef<number | null>(null);
  const promptShownAtRef = useRef<number | null>(null);

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

  // Module: Motion Detection (paused when secret menu is open)
  const { isMoving } = useMotionDetection(stream, {
    sensitivity: 50,
    checkInterval: 500,
    enabled: !showSecretSettings,
  });

  // Module: Photo Recognition (paused when secret menu is open)
  const recognitionOptions: PhotoRecognitionOptions = useMemo(
    () => ({
      // Keep debug info (and telemetry) active during a recording session even if the overlay
      // is collapsed so no frames are missed.
      enableDebugInfo: isDebugOverlayVisible || recordingState === 'recording',
      aspectRatio: 'auto',
      enableRectangleDetection: isEnabled('rectangle-detection'),
      continuousRecognition: true,
      switchRecognitionDelayMultiplier: 1.8,
      switchDistanceThreshold: 7,
      enabled: !showSecretSettings,
    }),
    [isDebugOverlayVisible, recordingState, isEnabled, showSecretSettings]
  );

  const {
    recognizedConcert,
    reset: resetRecognition,
    resetTelemetry,
    debugInfo,
    isRecognizing,
    frameQuality,
    activeGuidance,
    detectedRectangle,
    rectangleConfidence,
  } = usePhotoRecognition(stream, recognitionOptions);

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

  // Clear dismissed switch preference when user starts moving to a new area.
  const previousMovementRef = useRef(false);
  useEffect(() => {
    if (isMoving && !previousMovementRef.current && activeConcert) {
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

  const primaryActionLabel = isPlaying
    ? isInfoActive
      ? 'Pause Playback'
      : 'Pause Current Track'
    : isInfoActive
      ? 'Play Track'
      : 'Play Detected Track';

  const statusLabel = playbackError
    ? 'Playback Fault'
    : isInfoActive && isPlaying
      ? 'On Air'
      : showSwitchPrompt
        ? 'Switch Candidate'
        : recognizedConcert && !isInfoActive
          ? 'Locked Frame'
          : isInfoActive
            ? 'Deck Paused'
            : 'Preview';

  const promptText = playbackError
    ? playbackError.toLowerCase().includes(RETRY_HINT_TEXT)
      ? playbackError
      : `${playbackError} Check stream access and tap Play to retry.`
    : showSwitchPrompt
      ? `Current cut: ${activeConcert?.band}. Fresh lock found: ${pendingSwitchConcert?.band}.`
      : recognizedConcert
        ? 'Signal is locked. Playback runs continuously until you pause.'
        : activeConcert
          ? 'Archive is still live. Pause any time to stop the deck.'
          : 'Aim at a print to lock signal and start the deck.';

  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const progressColor = `hsl(${Math.round(210 + clampedProgress * 150)}, 80%, 70%)`;
  const nowPlayingLine = activeConcert
    ? `${activeConcert.band} • ${Math.round(progress * 100)}% through the cut`
    : isPlaying
      ? 'Deck is running — waiting on a stable band lock'
      : 'Receiver idle — lift the camera to wake playback';

  const actions =
    infoConcert && (isPlaying || recognizedConcert || activeConcert) ? (
      <>
        {showSwitchPrompt ? (
          <div>
            <button
              type="button"
              onClick={handleConfirmSwitch}
              aria-label={`Switch to ${pendingSwitchConcert?.band ?? 'detected track'}`}
            >
              Switch Deck
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
            Live now: {activeConcert?.band}. Confirm switch to {pendingSwitchConcert?.band}.
          </p>
        ) : null}
        {activeConcert && isInfoActive && !isPlaying ? (
          <p>Deck paused. Tap play to roll again.</p>
        ) : null}
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
      showInstructions={!displayedConcert}
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

  // Keep liveTelemetryRef in sync every render so the countdown effect can read the latest
  // value without it appearing in the effect's dependency array.
  liveTelemetryRef.current = telemetryForExport;

  const startRecording = useCallback(() => {
    resetTelemetry();
    switchDecisionTelemetryRef.current = createEmptySwitchDecisionTelemetry();
    capturedTelemetryRef.current = null;
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
    const timer = setTimeout(() => setSecondsRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [recordingState, secondsRemaining]);

  const handleTelemetryDownload = useCallback(() => {
    const telemetry = capturedTelemetryRef.current;
    if (!telemetry) return;

    const activeSettings = computeActiveSettings(recognitionOptions);
    const aiRecommendations = computeAiRecommendations(telemetry, activeSettings);
    const switchDecision = telemetry.switchDecision ?? {
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
    };
    const latencyValues = switchDecision.decisionLatenciesMs;
    const latencyMin = latencyValues.length > 0 ? Math.min(...latencyValues) : null;
    const latencyMax = latencyValues.length > 0 ? Math.max(...latencyValues) : null;

    const { blur, glare, lighting } = telemetry.frameQualityStats;
    const { matchedFrameDistances, nearMisses } = telemetry.hammingDistanceLog;

    const report = {
      timestamp: new Date().toISOString(),
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
      },
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
      failuresByCategory: Object.entries(telemetry.failureByCategory)
        .filter(([, count]) => count > 0)
        .map(([category, count]) => ({
          category,
          count,
          percentage:
            telemetry.totalFrames > 0
              ? ((count / telemetry.totalFrames) * 100).toFixed(1) + '%'
              : '0%',
        })),
      recentFailures: telemetry.failureHistory.map((failure) => ({
        category: failure.category,
        reason: failure.reason,
        frameHash: failure.frameHash,
        timestamp: new Date(failure.timestamp).toISOString(),
      })),
      switchDecisionMetrics: {
        shownCount: switchDecision.shownCount,
        confirmCount: switchDecision.confirmCount,
        dismissCount: switchDecision.dismissCount,
        decisionLatencyMs: {
          average: switchDecision.averageDecisionLatencyMs,
          last: switchDecision.lastDecisionLatencyMs,
          min: latencyMin,
          max: latencyMax,
          samples: latencyValues,
        },
        lastPromptSnapshot: switchDecision.lastPromptSnapshot,
      },
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
  }, [recognitionOptions]);

  const handleTelemetryDiscard = useCallback(() => {
    capturedTelemetryRef.current = null;
    setRecordingState('idle');
  }, []);

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
            isTestMode={false}
            recognizedConcert={recognizedConcert}
            isRecognizing={isRecognizing}
            debugInfo={debugInfo}
            onReset={resetRecognition}
            onVisibilityChange={setIsDebugOverlayVisible}
            testAudioUrl={testAudioUrl}
            telemetryRecording={{
              state: recordingState,
              secondsRemaining,
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
