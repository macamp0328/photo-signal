import { useState, useEffect } from 'react';
import type { RecognitionTelemetry } from './types';
import styles from './TelemetryExport.module.css';

const getLatencyBounds = (latencyValues: number[]): { min: number | null; max: number | null } => {
  if (latencyValues.length === 0) {
    return { min: null, max: null };
  }

  let min = latencyValues[0];
  let max = latencyValues[0];

  for (let index = 1; index < latencyValues.length; index += 1) {
    const value = latencyValues[index];
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  return { min, max };
};

interface TelemetryExportProps {
  telemetry: RecognitionTelemetry;
}

/**
 * Component to export telemetry data as downloadable JSON
 * Only visible in Test Mode for debugging and benchmarking
 */
export function TelemetryExport({ telemetry }: TelemetryExportProps) {
  const [exported, setExported] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Default to collapsed on mobile screens
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsCollapsed(isMobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const exportTelemetry = () => {
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
    const latencyBounds = getLatencyBounds(latencyValues);

    // Create comprehensive telemetry report
    const report = {
      timestamp: new Date().toISOString(),
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
          telemetry.qualityFrames > 0
            ? (
                (telemetry.successfulRecognitions /
                  (telemetry.successfulRecognitions + telemetry.failedAttempts)) *
                100
              ).toFixed(1) + '%'
            : '0%',
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
          min: latencyBounds.min,
          max: latencyBounds.max,
          samples: latencyValues,
        },
        lastPromptSnapshot: switchDecision.lastPromptSnapshot,
      },
      rawData: telemetry,
    };

    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photo-signal-telemetry-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  const exportMarkdownTable = () => {
    // Create markdown table matching research doc format
    const totalFrames = telemetry.totalFrames || 1; // Avoid division by zero

    const markdown = `# Photo Signal Telemetry Report

**Generated**: ${new Date().toISOString()}

## Summary Statistics

| Metric | Value | Percentage |
|--------|-------|------------|
| Total Frames | ${telemetry.totalFrames} | 100% |
| Quality Frames | ${telemetry.qualityFrames} | ${((telemetry.qualityFrames / totalFrames) * 100).toFixed(1)}% |
| Blur Rejections | ${telemetry.blurRejections} | ${((telemetry.blurRejections / totalFrames) * 100).toFixed(1)}% |
| Glare Rejections | ${telemetry.glareRejections} | ${((telemetry.glareRejections / totalFrames) * 100).toFixed(1)}% |
| Successful Recognitions | ${telemetry.successfulRecognitions} | - |
| Failed Attempts | ${telemetry.failedAttempts} | - |

## Failure Categories

| Category | Count | Percentage of Total Frames |
|----------|-------|----------------------------|
${Object.entries(telemetry.failureByCategory)
  .filter(([, count]) => count > 0)
  .map(
    ([category, count]) =>
      `| ${category} | ${count} | ${((count / totalFrames) * 100).toFixed(1)}% |`
  )
  .join('\n')}

## Recent Failures (Last ${telemetry.failureHistory.length})

${
  telemetry.failureHistory.length > 0
    ? `| Timestamp | Category | Reason | Frame Hash |
|-----------|----------|--------|------------|
${telemetry.failureHistory
  .slice(-10)
  .map(
    (failure) =>
      `| ${new Date(failure.timestamp).toISOString()} | ${failure.category} | ${failure.reason} | ${failure.frameHash} |`
  )
  .join('\n')}`
    : '*No failures recorded*'
}

## Interpretation

- **Blur Rejection Rate**: ${((telemetry.blurRejections / totalFrames) * 100).toFixed(1)}% of frames were too blurry for recognition (sharpness threshold not met)
- **Glare Rejection Rate**: ${((telemetry.glareRejections / totalFrames) * 100).toFixed(1)}% of frames had excessive glare (blown-out pixels)
- **Quality Frame Rate**: ${((telemetry.qualityFrames / totalFrames) * 100).toFixed(1)}% of frames passed quality checks and were hashed

**Top Failure Categories**:
${Object.entries(telemetry.failureByCategory)
  .filter(([, count]) => count > 0)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 3)
  .map(
    ([category, count], idx) =>
      `${idx + 1}. **${category}**: ${count} occurrences (${((count / totalFrames) * 100).toFixed(1)}%)`
  )
  .join('\n')}
`;

    // Create downloadable markdown file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photo-signal-telemetry-report-${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  // Calculate summary stats for display
  const qualityRate =
    telemetry.totalFrames > 0
      ? ((telemetry.qualityFrames / telemetry.totalFrames) * 100).toFixed(1)
      : '0';

  const blurRate =
    telemetry.totalFrames > 0
      ? ((telemetry.blurRejections / telemetry.totalFrames) * 100).toFixed(1)
      : '0';

  const glareRate =
    telemetry.totalFrames > 0
      ? ((telemetry.glareRejections / telemetry.totalFrames) * 100).toFixed(1)
      : '0';

  return (
    <div className={`${styles.container} ${isCollapsed ? styles.collapsed : ''}`}>
      {isCollapsed ? (
        <div className={styles.collapsedContent}>
          <span className={styles.collapsedLabel}>📊 Telemetry</span>
          <button
            onClick={() => setIsCollapsed(false)}
            className={styles.toggleButton}
            aria-label="Expand telemetry panel"
            aria-expanded={false}
          >
            Expand
          </button>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <h3 className={styles.title}>📊 Telemetry Data</h3>
            <button
              onClick={() => setIsCollapsed(true)}
              className={styles.toggleButton}
              aria-label="Collapse telemetry panel"
              aria-expanded={true}
            >
              Collapse
            </button>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.label}>Total Frames:</span>
              <span className={styles.value}>{telemetry.totalFrames}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.label}>Quality Rate:</span>
              <span className={styles.value}>{qualityRate}%</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.label}>Blur Rejections:</span>
              <span className={styles.value}>{blurRate}%</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.label}>Glare Rejections:</span>
              <span className={styles.value}>{glareRate}%</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              onClick={exportTelemetry}
              className={styles.button}
              aria-label="Export telemetry as JSON"
            >
              📥 Export JSON
            </button>
            <button
              onClick={exportMarkdownTable}
              className={styles.button}
              aria-label="Export telemetry as Markdown"
            >
              📝 Export Markdown Report
            </button>
          </div>

          {exported && <div className={styles.success}>✓ Telemetry exported successfully!</div>}
        </>
      )}
    </div>
  );
}
