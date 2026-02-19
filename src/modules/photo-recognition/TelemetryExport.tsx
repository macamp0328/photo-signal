import { useState, useEffect } from 'react';
import type { RecognitionTelemetry, PhotoRecognitionOptions } from './types';
import { computeActiveSettings, computeAiRecommendations } from './telemetryAnalysis';
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
  /** Active recognition options — included in exports so an AI agent knows what settings were in effect. */
  options?: PhotoRecognitionOptions;
}

/**
 * Component to export telemetry data as downloadable files.
 * Exports JSON (full data) and a Markdown report (AI Agent Briefing + stats).
 * Only visible in Test Mode for debugging and benchmarking.
 */
export function TelemetryExport({ telemetry, options }: TelemetryExportProps) {
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

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  const exportTelemetry = () => {
    const activeSettings = computeActiveSettings(options ?? {});
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
    const latencyBounds = getLatencyBounds(latencyValues);

    const { blur, glare, lighting } = telemetry.frameQualityStats;
    const { matchedFrameDistances, nearMisses } = telemetry.hammingDistanceLog;

    const report = {
      timestamp: new Date().toISOString(),
      sessionInfo: {
        userAgent: navigator.userAgent,
        exportedAt: new Date().toISOString(),
      },
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
          min: latencyBounds.min,
          max: latencyBounds.max,
          samples: latencyValues,
        },
        lastPromptSnapshot: switchDecision.lastPromptSnapshot,
      },
      rawData: telemetry,
    };

    triggerDownload(
      JSON.stringify(report, null, 2),
      `photo-signal-telemetry-${Date.now()}.json`,
      'application/json'
    );
  };

  const buildMarkdownReport = (): string => {
    const activeSettings = computeActiveSettings(options ?? {});
    const aiRecommendations = computeAiRecommendations(telemetry, activeSettings);
    const totalFrames = telemetry.totalFrames || 1;

    const { blur, glare, lighting } = telemetry.frameQualityStats;
    const { matchedFrameDistances, nearMisses } = telemetry.hammingDistanceLog;

    const avgSharpness =
      blur.sampleCount > 0 ? (blur.sharpnessSum / blur.sampleCount).toFixed(1) : 'n/a';
    const avgGlare =
      glare.sampleCount > 0 ? (glare.glarePercentSum / glare.sampleCount).toFixed(1) + '%' : 'n/a';
    const avgBrightness =
      lighting.sampleCount > 0 ? (lighting.brightnessSum / lighting.sampleCount).toFixed(1) : 'n/a';
    const avgNearMissDist =
      nearMisses.length > 0
        ? (nearMisses.reduce((s, nm) => s + nm.distance, 0) / nearMisses.length).toFixed(1)
        : 'n/a';
    const avgMatchDist =
      matchedFrameDistances.count > 0
        ? (matchedFrameDistances.sum / matchedFrameDistances.count).toFixed(1)
        : 'n/a';

    const recLines =
      aiRecommendations.length === 0
        ? '*No issues detected — recognition appears to be working well.*'
        : aiRecommendations
            .map(
              (rec, idx) =>
                `${idx + 1}. **[${rec.priority.toUpperCase()}]** ${rec.issue}\n` +
                `   - ${rec.recommendation}\n` +
                `   - Suggested change: \`${rec.parameterChange}\``
            )
            .join('\n\n');

    return `# Photo Signal Telemetry Report

**Generated**: ${new Date().toISOString()}

---

## AI Agent Briefing

*Share this report with an AI assistant to get specific parameter-change recommendations.*

### Active Settings

| Parameter | Value |
|-----------|-------|
| similarityThreshold | ${activeSettings.similarityThreshold} |
| matchMarginThreshold | ${activeSettings.matchMarginThreshold} |
| sharpnessThreshold | ${activeSettings.sharpnessThreshold} |
| glareThreshold | ${activeSettings.glareThreshold} |
| glarePercentageThreshold | ${activeSettings.glarePercentageThreshold}% |
| minBrightness | ${activeSettings.minBrightness} |
| maxBrightness | ${activeSettings.maxBrightness} |
| recognitionDelay | ${activeSettings.recognitionDelay}ms |
| checkInterval | ${activeSettings.checkInterval}ms |
| switchDistanceThreshold | ${activeSettings.switchDistanceThreshold} |
| switchMatchMarginThreshold | ${activeSettings.switchMatchMarginThreshold} |
| continuousRecognition | ${String(activeSettings.continuousRecognition)} |

### Recommended Parameter Changes

${recLines}

### Quality Diagnostics

| Metric | Value | Threshold |
|--------|-------|-----------|
| Avg sharpness of blur-rejected frames | ${avgSharpness} | ${activeSettings.sharpnessThreshold} (lower is blurrier) |
| Avg glare% of glare-rejected frames | ${avgGlare} | ${activeSettings.glarePercentageThreshold}% |
| Avg brightness of lighting-rejected frames | ${avgBrightness} | ${activeSettings.minBrightness}–${activeSettings.maxBrightness} |
| Near-miss frames (just above threshold) | ${nearMisses.length} | — |
| Avg Hamming distance of near-misses | ${avgNearMissDist} | threshold: ${activeSettings.similarityThreshold} |
| Avg Hamming distance of all matched frames | ${avgMatchDist} | — |

---

## Summary Statistics

| Metric | Value | Percentage |
|--------|-------|------------|
| Total Frames | ${telemetry.totalFrames} | 100% |
| Quality Frames | ${telemetry.qualityFrames} | ${((telemetry.qualityFrames / totalFrames) * 100).toFixed(1)}% |
| Blur Rejections | ${telemetry.blurRejections} | ${((telemetry.blurRejections / totalFrames) * 100).toFixed(1)}% |
| Glare Rejections | ${telemetry.glareRejections} | ${((telemetry.glareRejections / totalFrames) * 100).toFixed(1)}% |
| Lighting Rejections | ${telemetry.lightingRejections} | ${((telemetry.lightingRejections / totalFrames) * 100).toFixed(1)}% |
| Successful Recognitions | ${telemetry.successfulRecognitions} | — |
| Failed Attempts | ${telemetry.failedAttempts} | — |

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
  .slice(-20)
  .map(
    (failure) =>
      `| ${new Date(failure.timestamp).toISOString()} | ${failure.category} | ${failure.reason} | ${failure.frameHash} |`
  )
  .join('\n')}`
    : '*No failures recorded*'
}

## Near-Miss Frames

${
  nearMisses.length > 0
    ? `Frames whose best match was just above the similarity threshold (${activeSettings.similarityThreshold}). These are the closest misses.

| Timestamp | Hamming Distance | Frame Hash |
|-----------|-----------------|------------|
${nearMisses
  .map((nm) => `| ${new Date(nm.timestamp).toISOString()} | ${nm.distance} | ${nm.frameHash} |`)
  .join('\n')}`
    : `*No near-misses recorded. This means either all quality frames matched well, or all failures were far above the threshold (${activeSettings.similarityThreshold}). If recognition is failing, the issue is likely with frame quality rather than the similarity threshold.*`
}
`;
  };

  const exportMarkdownTable = () => {
    triggerDownload(
      buildMarkdownReport(),
      `photo-signal-telemetry-report-${Date.now()}.md`,
      'text/markdown'
    );
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
            <div className={styles.stat}>
              <span className={styles.label}>Near-misses:</span>
              <span className={styles.value}>{telemetry.hammingDistanceLog.nearMisses.length}</span>
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
              aria-label="Export telemetry as Markdown report"
            >
              📝 Export Report
            </button>
          </div>

          {exported && <div className={styles.success}>✓ Telemetry exported successfully!</div>}
        </>
      )}
    </div>
  );
}
