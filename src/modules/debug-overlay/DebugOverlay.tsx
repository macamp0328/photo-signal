/**
 * Debug Overlay Component
 *
 * Displays real-time photo recognition debugging information
 * Only visible when Test Mode is enabled
 */

import { useEffect, useState } from 'react';
import type { DebugOverlayProps, RecognitionStatus } from './types';
import styles from './DebugOverlay.module.css';
import { formatConcertTimestamp } from '../../utils/dateUtils';

// Display "waiting for frame" message if no frame received in 2x the normal check interval (≈1s)
const FRAME_TIMEOUT_THRESHOLD = 2;

export function DebugOverlay({
  recognizedConcert,
  isRecognizing,
  enabled,
  debugInfo,
  threshold,
  onReset,
}: DebugOverlayProps) {
  const [status, setStatus] = useState<RecognitionStatus>('IDLE');
  const [timeSinceLastCheck, setTimeSinceLastCheck] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const lastFrameHash = debugInfo?.lastFrameHash ?? null;
  const bestMatch = debugInfo?.bestMatch ?? null;
  const derivedThreshold = threshold ?? debugInfo?.similarityThreshold ?? 40;
  const stability = debugInfo?.stability ?? null;
  const frameSize = debugInfo?.frameSize;
  const frameCount = debugInfo?.frameCount;
  const concertCount = debugInfo?.concertCount;
  const checkInterval = debugInfo?.checkInterval;
  const aspectRatio = debugInfo?.aspectRatio;
  const recognitionDelayMs = debugInfo?.recognitionDelay;
  const lastCheckTime = debugInfo?.lastCheckTime;

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
    if (!enabled || !lastCheckTime) {
      return;
    }

    const updateTime = () => {
      setTimeSinceLastCheck(Math.max((Date.now() - lastCheckTime) / 1000, 0));
    };

    updateTime();
    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, [enabled, lastCheckTime]);

  useEffect(() => {
    if (!enabled) {
      setIsCollapsed(true);
    }
  }, [enabled]);

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

  const displayHash = lastFrameHash
    ? `${lastFrameHash.slice(0, 6)}...${lastFrameHash.slice(-4)}`
    : 'N/A';

  const similarityThreshold = ((256 - derivedThreshold) / 256) * 100;
  const countdownText = recognitionDelayMs
    ? `${(recognitionDelayMs / 1000).toFixed(1)}s hold required`
    : 'Hold steady to confirm match';
  const stabilityPercent = stability ? Math.round(stability.progress * 100) : 0;
  const lastCheckFormatted = lastCheckTime
    ? new Date(lastCheckTime).toLocaleTimeString([], { hour12: false })
    : '—';

  const isInactive = !enabled;

  return (
    <div
      className={`${styles.overlay} ${isCollapsed ? styles.collapsed : ''} ${isInactive ? styles.inactive : ''}`}
    >
      {isCollapsed ? (
        <div className={styles.collapsedContent}>
          <span className={styles.collapsedLabel}>
            {enabled ? '🐛 Debug overlay hidden' : '🐛 Debug overlay'}
          </span>
          <button
            type="button"
            className={styles.collapsedButton}
            onClick={() => setIsCollapsed(false)}
            aria-label="Show debug overlay"
            aria-expanded={isCollapsed}
          >
            Show overlay
          </button>
          {isInactive && (
            <span className={styles.collapsedHint}>Enable Test Mode for live data</span>
          )}
        </div>
      ) : !isInactive ? (
        <>
          <div className={styles.header}>
            <span className={styles.title}>🐛 Debug Info</span>
            <div className={styles.headerActions}>
              <span className={styles.badge}>TEST MODE</span>
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
                aria-expanded={!isCollapsed}
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
              <span className={styles.statusText}>{status}</span>
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
        </>
      ) : (
        <div className={styles.inactiveContent}>
          <div className={styles.header}>
            <span className={styles.title}>🐛 Debug Info</span>
            <div className={styles.headerActions}>
              <span className={styles.badge}>TEST MODE OFF</span>
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setIsCollapsed(true)}
                aria-label="Hide debug overlay"
                aria-expanded={!isCollapsed}
              >
                Hide
              </button>
            </div>
          </div>
          <div className={styles.section}>
            <div className={styles.inactiveMessage}>Enable Test Mode to view live debug data.</div>
          </div>
        </div>
      )}
    </div>
  );
}
