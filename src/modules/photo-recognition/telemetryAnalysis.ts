/**
 * Telemetry Analysis
 *
 * Pure functions for deriving actionable AI recommendations from recognition
 * telemetry data. No React, no DOM, no side effects — safe to unit test in Node.
 */

import type { PhotoRecognitionOptions, RecognitionTelemetry } from './types';

// ---------------------------------------------------------------------------
// Defaults — mirrors the constants in usePhotoRecognition.ts so the analysis
// module is self-contained (avoids a circular import).
// ---------------------------------------------------------------------------
const DEFAULTS = {
  recognitionDelay: 150,
  similarityThreshold: 14,
  matchMarginThreshold: 4,
  checkInterval: 120,
  sharpnessThreshold: 100,
  glareThreshold: 250,
  glarePercentageThreshold: 20,
  minBrightness: 50,
  maxBrightness: 220,
  enableRectangleDetection: false,
  rectangleConfidenceThreshold: 0.35,
} as const;

// ---------------------------------------------------------------------------
// ActiveSettings — all tunable parameters with no optional fields.
// ---------------------------------------------------------------------------

export interface ActiveSettings {
  recognitionDelay: number;
  similarityThreshold: number;
  matchMarginThreshold: number;
  checkInterval: number;
  sharpnessThreshold: number;
  glareThreshold: number;
  glarePercentageThreshold: number;
  minBrightness: number;
  maxBrightness: number;
  enableRectangleDetection: boolean;
  rectangleConfidenceThreshold: number;
}

/**
 * Resolve all recognition options to concrete values, filling any omitted
 * fields with their built-in defaults.
 */
export function computeActiveSettings(options: PhotoRecognitionOptions): ActiveSettings {
  return {
    recognitionDelay: options.recognitionDelay ?? DEFAULTS.recognitionDelay,
    similarityThreshold: options.similarityThreshold ?? DEFAULTS.similarityThreshold,
    matchMarginThreshold: options.matchMarginThreshold ?? DEFAULTS.matchMarginThreshold,
    checkInterval: options.checkInterval ?? DEFAULTS.checkInterval,
    sharpnessThreshold: options.sharpnessThreshold ?? DEFAULTS.sharpnessThreshold,
    glareThreshold: options.glareThreshold ?? DEFAULTS.glareThreshold,
    glarePercentageThreshold: options.glarePercentageThreshold ?? DEFAULTS.glarePercentageThreshold,
    minBrightness: options.minBrightness ?? DEFAULTS.minBrightness,
    maxBrightness: options.maxBrightness ?? DEFAULTS.maxBrightness,
    enableRectangleDetection: options.enableRectangleDetection ?? DEFAULTS.enableRectangleDetection,
    rectangleConfidenceThreshold:
      options.rectangleConfidenceThreshold ?? DEFAULTS.rectangleConfidenceThreshold,
  };
}

// ---------------------------------------------------------------------------
// AiRecommendation — a single actionable suggestion with priority.
// ---------------------------------------------------------------------------

export interface AiRecommendation {
  /** Urgency level. */
  priority: 'high' | 'medium' | 'low';
  /** One-sentence description of the observed problem. */
  issue: string;
  /** Human-readable suggestion with numerical justification. */
  recommendation: string;
  /** Ready-to-use parameter string, e.g. "sharpnessThreshold: 72" */
  parameterChange: string;
}

// ---------------------------------------------------------------------------
// Recommendation thresholds
// ---------------------------------------------------------------------------
const BLUR_RATE_HIGH = 0.4;
const BLUR_RATE_MEDIUM = 0.2;
const GLARE_RATE_HIGH = 0.3;
const GLARE_RATE_MEDIUM = 0.15;
const NO_MATCH_RATE_HIGH = 0.25;
const NO_MATCH_RATE_MEDIUM = 0.15;
const COLLISION_RATE_HIGH = 0.2;
const COLLISION_RATE_MEDIUM = 0.1;
const LOW_QUALITY_RATE = 0.3;

/**
 * Analyse telemetry and return a prioritised list of parameter-change
 * recommendations. Returns an empty array for zero-frame sessions or
 * sessions with no detected problems.
 */
export function computeAiRecommendations(
  telemetry: RecognitionTelemetry,
  settings: ActiveSettings
): AiRecommendation[] {
  const recommendations: AiRecommendation[] = [];

  if (telemetry.totalFrames === 0) {
    return recommendations;
  }

  const total = telemetry.totalFrames;
  const blurRate = telemetry.blurRejections / total;
  const glareRate = telemetry.glareRejections / total;
  const noMatchCount = telemetry.failureByCategory['no-match'];
  const collisionCount = telemetry.failureByCategory['collision'];
  const noMatchRate = noMatchCount / total;
  const collisionRate = collisionCount / total;
  const qualityRate = telemetry.qualityFrames / total;

  // ── Blur recommendation ───────────────────────────────────────────────────
  if (blurRate > BLUR_RATE_MEDIUM) {
    const { blur } = telemetry.frameQualityStats;
    const avgSharpness = blur.sampleCount > 0 ? blur.sharpnessSum / blur.sampleCount : null;
    const suggestedThreshold =
      avgSharpness !== null
        ? Math.round(avgSharpness * 0.85)
        : Math.round(settings.sharpnessThreshold * 0.8);

    recommendations.push({
      priority: blurRate > BLUR_RATE_HIGH ? 'high' : 'medium',
      issue: `High blur rejection rate: ${(blurRate * 100).toFixed(1)}% of frames rejected for motion blur`,
      recommendation:
        avgSharpness !== null
          ? `Reduce sharpnessThreshold from ${settings.sharpnessThreshold} to ${suggestedThreshold} — avg sharpness of rejected frames was ${avgSharpness.toFixed(1)} (threshold is ${settings.sharpnessThreshold})`
          : `Reduce sharpnessThreshold from ${settings.sharpnessThreshold} to ~${suggestedThreshold} (no sample data; this is an estimated 20% reduction)`,
      parameterChange: `sharpnessThreshold: ${suggestedThreshold}`,
    });
  }

  // ── Glare recommendation ──────────────────────────────────────────────────
  if (glareRate > GLARE_RATE_MEDIUM) {
    const { glare } = telemetry.frameQualityStats;
    const avgGlarePercent =
      glare.sampleCount > 0 ? glare.glarePercentSum / glare.sampleCount : null;
    const suggestedThreshold =
      avgGlarePercent !== null
        ? Math.min(Math.round(avgGlarePercent * 1.3), 60)
        : Math.min(settings.glarePercentageThreshold + 10, 60);

    recommendations.push({
      priority: glareRate > GLARE_RATE_HIGH ? 'high' : 'medium',
      issue: `High glare rejection rate: ${(glareRate * 100).toFixed(1)}% of frames rejected for glare`,
      recommendation:
        avgGlarePercent !== null
          ? `Raise glarePercentageThreshold from ${settings.glarePercentageThreshold} to ${suggestedThreshold} — avg glare% of rejected frames was ${avgGlarePercent.toFixed(1)}%`
          : `Raise glarePercentageThreshold from ${settings.glarePercentageThreshold} to ${suggestedThreshold}`,
      parameterChange: `glarePercentageThreshold: ${suggestedThreshold}`,
    });
  }

  // ── No-match recommendation ───────────────────────────────────────────────
  if (noMatchRate > NO_MATCH_RATE_MEDIUM) {
    const { nearMisses } = telemetry.hammingDistanceLog;
    const initialNearMisses = nearMisses.filter(
      (entry) =>
        entry.mode !== 'switch' &&
        (entry.thresholdUsed ?? settings.similarityThreshold) >= settings.similarityThreshold
    );
    const nearMissSamples = initialNearMisses.length > 0 ? initialNearMisses : nearMisses;
    const hasNearMisses = nearMissSamples.length > 0;
    const avgNearMiss = hasNearMisses
      ? nearMissSamples.reduce((sum, nm) => sum + nm.distance, 0) / nearMissSamples.length
      : null;
    const suggestedThreshold =
      avgNearMiss !== null ? Math.round(avgNearMiss * 1.1) : settings.similarityThreshold + 3;

    recommendations.push({
      priority: noMatchRate > NO_MATCH_RATE_HIGH ? 'high' : 'medium',
      issue: `High no-match rate: ${(noMatchRate * 100).toFixed(1)}% of frames found no match within the similarity threshold`,
      recommendation: hasNearMisses
        ? `Raise similarityThreshold from ${settings.similarityThreshold} to ${suggestedThreshold} — ${nearMissSamples.length} near-miss frames logged with avg distance ${avgNearMiss?.toFixed(1)}`
        : `Raise similarityThreshold from ${settings.similarityThreshold} to ${suggestedThreshold} (no near-miss data; move camera closer to the photo or check that the photo hash is in data.json)`,
      parameterChange: `similarityThreshold: ${suggestedThreshold}`,
    });
  }

  // ── Collision recommendation ──────────────────────────────────────────────
  if (collisionRate > COLLISION_RATE_MEDIUM) {
    const { ambiguousMarginHistogram, ambiguousPairCounts, ambiguousCount, nearThresholdCount } =
      telemetry.collisionStats;

    let shouldRaiseMargin = false;
    let suggestedMargin = settings.matchMarginThreshold;
    let recommendationBody: string;

    const topPair = Object.entries(ambiguousPairCounts).sort((a, b) => b[1] - a[1])[0];

    if (ambiguousCount > 0) {
      const lowMarginBias = ambiguousMarginHistogram['0-1'] + ambiguousMarginHistogram['2'];
      const highMarginBias = ambiguousMarginHistogram['3-4'] + ambiguousMarginHistogram['5+'];
      const hasMarginSignal = lowMarginBias + highMarginBias + ambiguousMarginHistogram.unknown > 0;

      shouldRaiseMargin = hasMarginSignal ? lowMarginBias > highMarginBias : true;
      suggestedMargin = shouldRaiseMargin
        ? settings.matchMarginThreshold + 1
        : settings.matchMarginThreshold;

      recommendationBody = shouldRaiseMargin
        ? `Raise matchMarginThreshold from ${settings.matchMarginThreshold} to ${suggestedMargin}; collision margins are mostly low (0–2), indicating weak separation between best and second-best matches.`
        : `Keep matchMarginThreshold at ${settings.matchMarginThreshold}; collisions are not dominated by low margins, so prioritize refreshing photo hashes and verifying print/image alignment.`;
    } else {
      recommendationBody =
        nearThresholdCount > 0
          ? 'Collision events are primarily near the similarity threshold with no clear ambiguous second-best match. Prefer lowering similarityThreshold slightly or refreshing photo hashes and verifying print/image alignment rather than adjusting matchMarginThreshold.'
          : `Collisions lack clear ambiguity margin data; prioritize refreshing photo hashes and verifying print/image alignment before changing matchMarginThreshold.`;
    }

    recommendations.push({
      priority: collisionRate > COLLISION_RATE_HIGH ? 'high' : 'medium',
      issue: `High collision rate: ${(collisionRate * 100).toFixed(1)}% of frames had two photos too similar to distinguish`,
      recommendation: `${recommendationBody}${
        topPair ? ` Most frequent ambiguous pair: ${topPair[0]} (${topPair[1]} frames).` : ''
      }`,
      parameterChange: shouldRaiseMargin
        ? `matchMarginThreshold: ${suggestedMargin}`
        : 'refreshHashes: true',
    });
  }

  // ── Low quality frame rate (catch-all) ────────────────────────────────────
  if (qualityRate < LOW_QUALITY_RATE && recommendations.length === 0) {
    const causes = [
      ['blur', telemetry.blurRejections] as const,
      ['glare', telemetry.glareRejections] as const,
      ['lighting', telemetry.lightingRejections] as const,
    ];
    // sort descending by count
    const sorted = [...causes].sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0];

    recommendations.push({
      priority: 'high',
      issue: `Very low quality frame rate: only ${(qualityRate * 100).toFixed(1)}% of frames pass quality checks`,
      recommendation: `Dominant rejection cause is "${dominant[0]}" (${dominant[1]} frames, ${((dominant[1] / total) * 100).toFixed(1)}%). Adjust the ${dominant[0]} threshold or improve shooting conditions.`,
      parameterChange: `Check ${dominant[0]} threshold settings`,
    });
  }

  return recommendations;
}
