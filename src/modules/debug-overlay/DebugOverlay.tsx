/**
 * Debug Overlay Component
 *
 * Displays actionable photo recognition debugging controls
 * Visible when the Debug Overlay feature flag is enabled
 */

import { useEffect, useState } from 'react';
import type { DebugOverlayProps, RecognitionStatus } from './types';
import styles from './DebugOverlay.module.css';
import { useAudioTest } from './useAudioTest';

export function DebugOverlay({
  recognizedConcert,
  isRecognizing,
  enabled,
  onVisibilityChange,
  debugInfo,
  recommendations = [],
  onReset,
  testAudioUrl,
}: DebugOverlayProps) {
  const [status, setStatus] = useState<RecognitionStatus>('IDLE');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const { runTest, isTestRunning, testResult, resetTest } = useAudioTest();

  const lastFrameHash = debugInfo?.lastFrameHash ?? null;
  const bestMatch = debugInfo?.bestMatch ?? null;
  const secondBestMatch = debugInfo?.secondBestMatch ?? null;
  const bestMatchMargin = debugInfo?.bestMatchMargin ?? null;
  const primaryRecommendation = recommendations[0] ?? null;
  const glareRecommendation = recommendations.find((recommendation) =>
    recommendation.parameterChange.startsWith('glarePercentageThreshold')
  );

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

  const isCollapsedView = isCollapsed;
  const statusCode = testResult?.diagnostic.httpStatus;
  const isSuccessfulFetch = typeof statusCode === 'number' && statusCode >= 200 && statusCode < 300;
  const corsDisplay = testResult
    ? (testResult.diagnostic.corsOrigin ??
      (isSuccessfulFetch ? 'Not exposed to browser' : 'No header'))
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
            <span className={styles.title}>Debug</span>
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

          {/* Guidance */}
          {primaryRecommendation && (
            <div className={styles.section}>
              <div className={styles.label}>Guidance</div>
              {glareRecommendation && (
                <div className={styles.glareCallout}>
                  <div className={styles.glareCalloutTitle}>Glare is usually angle-driven</div>
                  <div className={styles.glareCalloutBody}>
                    Tilt or sidestep the phone so the bright reflection moves off the printed photo
                    before loosening the rejection threshold.
                  </div>
                </div>
              )}
              <div className={styles.guidanceIssue}>{primaryRecommendation.issue}</div>
              <div className={styles.guidanceText}>{primaryRecommendation.recommendation}</div>
              <div className={styles.guidanceHint}>{primaryRecommendation.parameterChange}</div>
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
        </>
      )}
    </div>
  );
}
