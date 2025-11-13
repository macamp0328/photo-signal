/**
 * Debug Overlay Component
 *
 * Displays real-time photo recognition debugging information
 * Only visible when Test Mode is enabled
 */

import { useEffect, useState } from 'react';
import type { DebugOverlayProps, RecognitionStatus } from './types';
import styles from './DebugOverlay.module.css';

export function DebugOverlay({
  recognizedConcert,
  isRecognizing,
  enabled,
  lastFrameHash,
  bestMatch,
  threshold = 10,
}: DebugOverlayProps) {
  const [status, setStatus] = useState<RecognitionStatus>('IDLE');
  const [timeSinceLastCheck, setTimeSinceLastCheck] = useState<number>(0);

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

  // Update time since last check
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSinceLastCheck((prev) => prev + 0.1);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Reset timer when new frame is checked
  useEffect(() => {
    if (lastFrameHash) {
      setTimeSinceLastCheck(0);
    }
  }, [lastFrameHash]);

  if (!enabled) {
    return null;
  }

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

  // Truncate hash for display
  const displayHash = lastFrameHash
    ? `${lastFrameHash.slice(0, 6)}...${lastFrameHash.slice(-4)}`
    : 'N/A';

  // Calculate similarity percentage
  const similarityThreshold = ((64 - threshold) / 64) * 100;

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <span className={styles.title}>🐛 Debug Info</span>
        <span className={styles.badge}>TEST MODE</span>
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
          {timeSinceLastCheck < 2
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

      {/* Threshold */}
      <div className={styles.section}>
        <div className={styles.label}>Threshold</div>
        <div className={styles.thresholdInfo}>
          Distance ≤ {threshold} (≥ {similarityThreshold.toFixed(0)}% similarity)
        </div>
      </div>

      {/* Recognized Concert */}
      {recognizedConcert && (
        <div className={`${styles.section} ${styles.recognized}`}>
          <div className={styles.label}>🎵 Recognized</div>
          <div className={styles.concertName}>{recognizedConcert.band}</div>
          <div className={styles.concertVenue}>{recognizedConcert.venue}</div>
          <div className={styles.concertDate}>{recognizedConcert.date}</div>
        </div>
      )}
    </div>
  );
}
