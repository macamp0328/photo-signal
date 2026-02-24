/**
 * Debug Overlay Component
 *
 * Displays real-time photo recognition debugging information
 * Visible when the Debug Overlay feature flag is enabled
 */

import { useEffect, useState } from 'react';
import type { DebugOverlayProps, RecognitionStatus } from './types';
import { ROUTINE_DEFINITIONS } from './routineDefinitions';
import styles from './DebugOverlay.module.css';
import { formatConcertTimestamp } from '../../utils/dateUtils';
import { useAudioTest } from './useAudioTest';

// Display "waiting for frame" message if no frame received in 2x the normal check interval (≈1s)
const FRAME_TIMEOUT_THRESHOLD = 2;
const DEFAULT_SIMILARITY_THRESHOLD = 14;
const PHASH_DISTANCE_RANGE = 64;

export function DebugOverlay({
  recognizedConcert,
  isRecognizing,
  enabled,
  onVisibilityChange,
  debugInfo,
  threshold,
  onReset,
  testAudioUrl,
  telemetryRecording,
}: DebugOverlayProps) {
  const [status, setStatus] = useState<RecognitionStatus>('IDLE');
  const [timeSinceLastCheck, setTimeSinceLastCheck] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const { runTest, isTestRunning, testResult, resetTest } = useAudioTest();

  const lastFrameHash = debugInfo?.lastFrameHash ?? null;
  const bestMatch = debugInfo?.bestMatch ?? null;
  const secondBestMatch = debugInfo?.secondBestMatch ?? null;
  const bestMatchMargin = debugInfo?.bestMatchMargin ?? null;
  const derivedThreshold =
    threshold ?? debugInfo?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const stability = debugInfo?.stability ?? null;
  const frameSize = debugInfo?.frameSize;
  const frameCount = debugInfo?.frameCount;
  const concertCount = debugInfo?.concertCount;
  const checkInterval = debugInfo?.checkInterval;
  const aspectRatio = debugInfo?.aspectRatio;
  const recognitionDelayMs = debugInfo?.recognitionDelay;
  const lastCheckTime = debugInfo?.lastCheckTime;
  const indexModeFrames = debugInfo?.telemetry.index_mode_used ?? 0;
  const fallbackModeFrames = debugInfo?.telemetry.fallback_mode_used ?? 0;
  const candidateCountTelemetry = debugInfo?.telemetry.candidate_count_per_frame;
  const lastCandidateComparisons = candidateCountTelemetry?.last ?? 0;
  const averageCandidateComparisons =
    candidateCountTelemetry && candidateCountTelemetry.frames > 0
      ? Math.round(candidateCountTelemetry.total / candidateCountTelemetry.frames)
      : 0;

  // Default to collapsed on mobile screens
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile && enabled) {
        setIsCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [enabled]);

  // Determine recognition status
  useEffect(() => {
    if (recognizedConcert) {
      setStatus('RECOGNIZED');
    } else if (isRecognizing) {
      setStatus('MATCHING');
    } else if (lastFrameHash) {
      setStatus('CHECKING');
    } else {
      setStatus('IDLE');
    }
  }, [recognizedConcert, isRecognizing, lastFrameHash]);

  // Update time since last check using the actual timestamp from debug info
  useEffect(() => {
    if (!lastCheckTime) {
      return;
    }

    const updateTime = () => {
      setTimeSinceLastCheck(Math.max((Date.now() - lastCheckTime) / 1000, 0));
    };

    updateTime();
    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, [enabled, lastCheckTime]);

  // Status indicator color
  const statusColors: Record<RecognitionStatus, string> = {
    IDLE: styles.statusIdle,
    CHECKING: styles.statusChecking,
    MATCHING: styles.statusMatching,
    RECOGNIZED: styles.statusRecognized,
  };

  // Status indicator emoji
  const statusEmoji: Record<RecognitionStatus, string> = {
    IDLE: '⚪',
    CHECKING: '🔵',
    MATCHING: '🟡',
    RECOGNIZED: '🟢',
  };

  const statusLabel: Record<RecognitionStatus, string> = {
    IDLE: 'Idle',
    CHECKING: 'Checking',
    MATCHING: 'Matching',
    RECOGNIZED: 'Recognized',
  };

  const displayHash = lastFrameHash
    ? `${lastFrameHash.slice(0, 6)}...${lastFrameHash.slice(-4)}`
    : 'N/A';

  const similarityThreshold =
    ((PHASH_DISTANCE_RANGE - Math.min(derivedThreshold, PHASH_DISTANCE_RANGE)) /
      PHASH_DISTANCE_RANGE) *
    100;
  const countdownText = recognitionDelayMs
    ? `${(recognitionDelayMs / 1000).toFixed(1)}s hold required`
    : 'Hold steady to confirm match';
  const stabilityPercent = stability ? Math.round(stability.progress * 100) : 0;
  const lastCheckFormatted = lastCheckTime
    ? new Date(lastCheckTime).toLocaleTimeString([], { hour12: false })
    : '—';

  const isCollapsedView = isCollapsed;
  const statusCode = testResult?.diagnostic.httpStatus;
  const isSuccessfulFetch = typeof statusCode === 'number' && statusCode >= 200 && statusCode < 300;
  const corsDisplay = testResult
    ? (testResult.diagnostic.corsOrigin ??
      (isSuccessfulFetch ? 'Not exposed to browser' : 'No header'))
    : null;
  const selectedRoutineDefinition = telemetryRecording.selectedRoutine
    ? (ROUTINE_DEFINITIONS.find((r) => r.type === telemetryRecording.selectedRoutine) ?? null)
    : null;

  useEffect(() => {
    onVisibilityChange?.(enabled && !isCollapsed);
  }, [enabled, isCollapsed, onVisibilityChange]);

  if (!enabled) {
    return null;
  }

  return (
    <div className={`${styles.overlay} ${isCollapsedView ? styles.collapsed : ''}`}>
      {isCollapsedView ? (
        <div className={styles.collapsedContent}>
          <button
            type="button"
            className={styles.collapsedButton}
            onClick={() => setIsCollapsed(false)}
            aria-label="Show debug overlay"
            aria-expanded={false}
          >
            Show overlay
          </button>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <span className={styles.title}>🐛 Debug Info</span>
            <div className={styles.headerActions}>
              {onReset && (
                <button
                  type="button"
                  className={styles.resetButton}
                  onClick={onReset}
                  disabled={!!recognizedConcert || isRecognizing}
                  aria-label="Reset recognition"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setIsCollapsed(true)}
                aria-label="Hide debug overlay"
                aria-expanded={!isCollapsedView}
              >
                Hide
              </button>
            </div>
          </div>

          {/* Status */}
          <div className={styles.section}>
            <div className={styles.statusRow}>
              <span className={`${styles.statusIndicator} ${statusColors[status]}`}>
                {statusEmoji[status]}
              </span>
              <span className={styles.statusText}>{statusLabel[status]}</span>
            </div>
          </div>

          {/* Frame Hash */}
          <div className={styles.section}>
            <div className={styles.label}>Frame Hash</div>
            <div className={styles.hash}>{displayHash}</div>
            <div className={styles.hint}>
              {timeSinceLastCheck < FRAME_TIMEOUT_THRESHOLD
                ? `Updated ${timeSinceLastCheck.toFixed(1)}s ago`
                : 'Waiting for frame...'}
            </div>
          </div>

          {/* Best Match */}
          {bestMatch && (
            <div className={styles.section}>
              <div className={styles.label}>Best Match</div>
              <div className={styles.matchName}>{bestMatch.concert.band}</div>
              <div className={styles.matchStats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Distance:</span>
                  <span className={styles.statValue}>{bestMatch.distance}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Similarity:</span>
                  <span className={styles.statValue}>{bestMatch.similarity.toFixed(1)}%</span>
                </div>
              </div>
              {secondBestMatch ? (
                <div className={styles.matchStats}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>2nd Best:</span>
                    <span className={styles.statValue}>{secondBestMatch.concert.band}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Margin:</span>
                    <span className={styles.statValue}>
                      {bestMatchMargin !== null ? bestMatchMargin.toFixed(1) : '—'}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Countdown */}
          <div className={styles.section}>
            <div className={styles.label}>Countdown</div>
            {stability ? (
              <div className={styles.timerSection}>
                <div className={styles.timerStats}>
                  <span>{(stability.elapsedMs / 1000).toFixed(1)}s elapsed</span>
                  <span>{(stability.remainingMs / 1000).toFixed(1)}s remaining</span>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${stabilityPercent}%` }}
                    aria-valuenow={stabilityPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <div className={styles.timerHint}>Hold steady for {countdownText}</div>
              </div>
            ) : (
              <div className={styles.timerHint}>{countdownText}</div>
            )}
          </div>

          {/* Threshold */}
          <div className={styles.section}>
            <div className={styles.label}>Threshold</div>
            <div className={styles.thresholdInfo}>
              Distance ≤ {derivedThreshold} (≥ {similarityThreshold.toFixed(0)}% similarity)
            </div>
          </div>

          {/* Metrics */}
          {debugInfo && (
            <div className={styles.section}>
              <div className={styles.label}>Metrics</div>
              <div className={styles.metricGrid}>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Frames</span>
                  <span className={styles.metricValue}>{frameCount ?? '—'}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Concerts</span>
                  <span className={styles.metricValue}>{concertCount ?? '—'}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Interval</span>
                  <span className={styles.metricValue}>
                    {checkInterval ? `${(checkInterval / 1000).toFixed(1)}s` : '—'}
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Aspect</span>
                  <span className={styles.metricValue}>{aspectRatio ?? '—'}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Frame Size</span>
                  <span className={styles.metricValue}>
                    {frameSize ? `${frameSize.width}×${frameSize.height}` : '—'}
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Last Check</span>
                  <span className={styles.metricValue}>{lastCheckFormatted}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Index Frames</span>
                  <span className={styles.metricValue}>{indexModeFrames}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Fallback Frames</span>
                  <span className={styles.metricValue}>{fallbackModeFrames}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Candidates (Last)</span>
                  <span className={styles.metricValue}>{lastCandidateComparisons}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Candidates (Avg)</span>
                  <span className={styles.metricValue}>{averageCandidateComparisons}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recognized Concert */}
          {recognizedConcert && (
            <div className={`${styles.section} ${styles.recognized}`}>
              <div className={styles.label}>🎵 Recognized</div>
              <div className={styles.concertName}>{recognizedConcert.band}</div>
              <div className={styles.concertVenue}>{recognizedConcert.venue}</div>
              <div className={styles.concertDate}>
                {formatConcertTimestamp(recognizedConcert.date)}
              </div>
            </div>
          )}

          {/* Audio Test */}
          {testAudioUrl && (
            <div className={styles.section}>
              <div className={styles.label}>Audio Test</div>
              {!testResult && !isTestRunning && (
                <button
                  type="button"
                  className={styles.testButton}
                  onClick={() => runTest(testAudioUrl)}
                  aria-label="Test audio playback"
                >
                  Test Song
                </button>
              )}
              {isTestRunning && <div className={styles.testRunning}>Testing...</div>}
              {testResult && (
                <div className={styles.testResults}>
                  <div className={styles.testRow}>
                    <span className={styles.testLabel}>Fetch:</span>
                    <span
                      className={
                        testResult.diagnostic.httpStatus !== null &&
                        testResult.diagnostic.httpStatus >= 200 &&
                        testResult.diagnostic.httpStatus < 300
                          ? styles.testSuccess
                          : styles.testError
                      }
                    >
                      {testResult.diagnostic.httpStatus ?? 'Network Error'}
                    </span>
                  </div>
                  <div className={styles.testRow}>
                    <span className={styles.testLabel}>CORS:</span>
                    <span className={styles.testValue}>{corsDisplay}</span>
                  </div>
                  <div className={styles.testRow}>
                    <span className={styles.testLabel}>Playback:</span>
                    <span
                      className={
                        testResult.playbackOutcome === 'success'
                          ? styles.testSuccess
                          : styles.testError
                      }
                    >
                      {testResult.playbackOutcome}
                    </span>
                  </div>
                  {testResult.playbackDetail && (
                    <div className={styles.testMessage}>{testResult.playbackDetail}</div>
                  )}
                  <div className={styles.testMessage}>{testResult.diagnostic.message}</div>
                  <div className={styles.testDuration}>{testResult.durationMs}ms</div>
                  <button
                    type="button"
                    className={styles.testClearButton}
                    onClick={resetTest}
                    aria-label="Clear test results"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Telemetry Recording */}
          <div className={styles.telemetrySection}>
            {telemetryRecording.state === 'idle' &&
              (telemetryRecording.selectedRoutine === null ? (
                <div className={styles.routinePicker}>
                  <div className={styles.label}>Test Routine</div>
                  <select
                    className={styles.routineSelect}
                    value=""
                    onChange={(e) => {
                      const routine = ROUTINE_DEFINITIONS.find((r) => r.type === e.target.value);
                      if (routine) {
                        telemetryRecording.onSelectRoutine(routine.type);
                      }
                    }}
                    aria-label="Select test routine"
                  >
                    <option value="" disabled>
                      Choose a routine…
                    </option>
                    {ROUTINE_DEFINITIONS.map((r) => (
                      <option key={r.type} value={r.type}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={styles.routineReady}>
                  <div className={styles.label}>{selectedRoutineDefinition?.label}</div>
                  <p className={styles.routineInstructions}>
                    {selectedRoutineDefinition?.instructions}
                  </p>
                  <div className={styles.telemetryActions}>
                    <button
                      type="button"
                      className={styles.telemetryButton}
                      onClick={telemetryRecording.onStart}
                      aria-label="Start 30-second telemetry recording"
                    >
                      Record 30s
                    </button>
                    <button
                      type="button"
                      className={styles.telemetryButtonSecondary}
                      onClick={telemetryRecording.onClearRoutine}
                      aria-label="Change routine selection"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ))}
            {telemetryRecording.state === 'recording' && (
              <div className={styles.routineReady}>
                {telemetryRecording.selectedRoutine && (
                  <div className={styles.routineActiveLabel}>
                    {selectedRoutineDefinition?.label}
                  </div>
                )}
                <p className={styles.telemetryRecording}>
                  Recording… {telemetryRecording.secondsRemaining}s
                </p>
              </div>
            )}
            {telemetryRecording.state === 'done' && (
              <div className={styles.telemetryActions}>
                {telemetryRecording.selectedRoutine && (
                  <div className={styles.routineActiveLabel}>
                    {selectedRoutineDefinition?.label}
                  </div>
                )}
                <button
                  type="button"
                  className={styles.telemetryButton}
                  onClick={telemetryRecording.onDownload}
                  aria-label="Download telemetry report"
                >
                  Download Report
                </button>
                <button
                  type="button"
                  className={styles.telemetryButtonSecondary}
                  onClick={telemetryRecording.onDiscard}
                  aria-label="Discard telemetry recording"
                >
                  Discard
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
