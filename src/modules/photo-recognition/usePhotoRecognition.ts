import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataService } from '../../services/data-service';
import type { Concert, TapIntent } from '../../types';
import { RectangleDetectionService } from '../photo-rectangle-detection';
import type { DetectedRectangle, RectangleRoiHint } from '../photo-rectangle-detection';
import { computePHash } from './algorithms/phash';
import { hammingDistance } from './algorithms/hamming';
import {
  createEmptyTelemetry,
  getPHashes,
  recordCollisionDetails,
  recordFailure,
  similarityPercent,
} from './helpers';
import { calculateFramedRegion, calculateVisibleViewport, type ViewportRegion } from './framing';
import { calculateAdaptiveQualityThresholds, computeAllQualityMetrics } from './algorithms/utils';
import { useRecognitionWorker } from './useRecognitionWorker';
import type {
  WorkerFrameResult,
  WorkerHashEntry,
  WorkerRecognitionConfig,
} from './worker-protocol';
import type {
  AspectRatio,
  FailureCategory,
  FrameQualityInfo,
  PhotoRecognitionHook,
  PhotoRecognitionOptions,
  RecognitionDebugInfo,
  RecognitionTelemetry,
  StabilityDebugInfo,
} from './types';

/**
 * pHash Hamming distance threshold for initial recognition.
 * pHash produces a 64-bit hash; distances range 0–64, where 0 = identical.
 * A distance of 14 corresponds to roughly 78% similarity — tuned to absorb
 * print variation, device noise, and typical lighting differences without
 * introducing unacceptable false positives for the current dataset.
 *
 * This value was chosen based on empirical evaluation (offline test sets and
 * field validation). If you change it, re-run the evaluation described in
 * docs/PHOTO_RECOGNITION_DEEP_DIVE.md and adjust related thresholds
 * (INSTANT_DISTANCE_THRESHOLD and QUALITY_GATING_DISTANCE_THRESHOLD) as
 * needed to preserve the intended ratios.
 */
const DEFAULT_SIMILARITY_THRESHOLD = 14;

/**
 * Default polling cadence in milliseconds.
 * Adaptive scheduling uses this value for the idle (no candidate) rate and
 * drops to 80 ms when a candidate is being tracked. Tests that supply a
 * custom checkInterval bypass adaptive logic entirely.
 *
 * Raised from 180 ms to 120 ms (8.3 fps idle) to reduce time-to-first-check.
 */
const DEFAULT_CHECK_INTERVAL = 120;

/**
 * Milliseconds a candidate match must remain the best match before it is
 * confirmed. Acts as a debounce — the camera must dwell on the photo long
 * enough to rule out transient camera movement or an accidental close pass
 * next to a different print.
 *
 * Reduced from 300 ms to 150 ms — still debounces accidental sweeps but
 * gets to confirmation faster given the zero mis-recognition track record.
 */
const DEFAULT_RECOGNITION_DELAY = 150;

/** Assumed display aspect ratio when none is specified (1 = square/portrait). */
const DEFAULT_DISPLAY_ASPECT_RATIO = 1;

/**
 * pHash distance at which a match is confirmed in a single frame, skipping
 * recognitionDelay entirely. ≤10/64 bits ≈ ≥84% similarity — well within the
 * 14-distance similarity threshold. Raised proportionally with the similarity
 * threshold to maintain the same fast-path ratio.
 */
const INSTANT_DISTANCE_THRESHOLD = 10;

/**
 * When the best-match distance falls at or below this value the frame is
 * almost certainly correct. Expensive quality checks (blur, glare, lighting)
 * are skipped to avoid rejecting a valid close-distance frame on quality
 * grounds.
 *
 * Kept 2 below DEFAULT_SIMILARITY_THRESHOLD (14) so that borderline matches
 * (distance 13–14) still pass through quality filtering, while very confident
 * matches (≤12) skip it entirely.
 */
const QUALITY_GATING_DISTANCE_THRESHOLD = 12;

if (import.meta.env.DEV && QUALITY_GATING_DISTANCE_THRESHOLD > DEFAULT_SIMILARITY_THRESHOLD) {
  throw new Error(
    'QUALITY_GATING_DISTANCE_THRESHOLD must be less than or equal to DEFAULT_SIMILARITY_THRESHOLD'
  );
}

/**
 * Resolution used for quality-check captures (sharpness, glare, lighting).
 * Larger than the 64×64 hash capture so that resolution-sensitive metrics
 * (especially Laplacian variance for sharpness) remain accurate, while still
 * being far smaller than the full framed-region dimensions.
 */
const QUALITY_CAPTURE_SIZE = 128;

/**
 * Consecutive frames returning the same match needed for the "instant
 * consecutive" confirmation path — used when distance is between
 * INSTANT_DISTANCE_THRESHOLD and the normal similarity threshold.
 */
const CONSECUTIVE_MATCHES_FOR_INSTANT_CONFIRM = 2;

/**
 * Minimum Hamming distance gap between the best match and the best match from
 * a *different* concert. With Change A (cross-concert secondBestMatch), same-
 * concert sibling hashes no longer compete for this slot, so a margin of 2 is
 * meaningful: the winning concert must be at least 2 bits closer than its
 * nearest rival from any other concert.
 *
 * Set to 4 as a balanced baseline for collision-first tuning.
 * Runtime logic applies an additional +1 margin requirement for borderline
 * distances near the active threshold, so strong close-distance matches remain
 * responsive while noisy threshold-edge matches are filtered more strictly.
 */
const DEFAULT_MATCH_MARGIN_THRESHOLD = 4;

// ---------------------------------------------------------------------------
// Crop-based partial photo recognition thresholds
// ---------------------------------------------------------------------------

const RECOGNITION_INDEX_URL = '/data.recognition.v2.json';

// ---------------------------------------------------------------------------
// Module-level pure helpers (no React state, no refs)
// ---------------------------------------------------------------------------

/** Compact type used throughout the matching pipeline. */
export type MatchCandidate = { concert: Concert; distance: number };
type HashEntry = { hash: string; concert: Concert };

const HASH_BUCKET_PREFIX_LENGTH = 0;

interface RecognitionIndexEntryV2 {
  concertId: number;
  phash: string[];
}

interface RecognitionIndexPayloadV2 {
  version: 2;
  entries: RecognitionIndexEntryV2[];
}

function isRecognitionIndexPayloadV2(payload: unknown): payload is RecognitionIndexPayloadV2 {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const asPayload = payload as Partial<RecognitionIndexPayloadV2>;
  return asPayload.version === 2 && Array.isArray(asPayload.entries);
}

const BLUR_REJECTION_CONSECUTIVE_FRAMES = 2;
const BLUR_CLEAR_TRACKING_CONSECUTIVE_FRAMES = 3;
const RECTANGLE_CONFIDENCE_HOLD_FRAMES = 2;
const DEFAULT_TAP_ROI_LOCK_MS = 500;
const DEFAULT_TAP_ROI_DECAY_MS = 1200;
const DEFAULT_TAP_ROI_RADIUS = 0.28;
const ROI_FALLBACK_FRAME_INTERVAL = 3;

/**
 * Scans concertHashList and returns the best and second-best pHash matches for
 * the given frame hash. Pure function with no side-effects.
 *
 * `secondBestMatch` is the closest match from a *different* concert than
 * `bestMatch`. Multiple exposure variants of the same concert (dark/normal/
 * bright) share the same concert.id and are never placed into secondBestMatch,
 * so the margin check only measures disambiguation against rival concerts —
 * not against the winning concert's own variant hashes.
 */
export function findBestMatches(
  currentHash: string,
  concertHashList: ReadonlyArray<HashEntry>
): { bestMatch: MatchCandidate | null; secondBestMatch: MatchCandidate | null } {
  let bestMatch: MatchCandidate | null = null;
  let secondBestMatch: MatchCandidate | null = null;

  for (const { hash, concert } of concertHashList) {
    const distance = hammingDistance(currentHash, hash);
    if (!bestMatch || distance < bestMatch.distance) {
      // Only carry the displaced best into secondBestMatch when it belongs to
      // a different concert — same-concert sibling hashes are not rivals.
      if (bestMatch && bestMatch.concert.id !== concert.id) {
        secondBestMatch = bestMatch;
      }
      bestMatch = { concert, distance };
    } else if (
      concert.id !== bestMatch.concert.id && // cross-concert entries only
      (!secondBestMatch || distance < secondBestMatch.distance)
    ) {
      secondBestMatch = { concert, distance };
    }
  }

  return { bestMatch, secondBestMatch };
}

function getHashBucketKey(hash: string): string {
  return hash.slice(0, HASH_BUCKET_PREFIX_LENGTH).toLowerCase();
}

function bucketHashEntries<T extends { hash: string }>(
  entries: ReadonlyArray<T>
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();

  for (const entry of entries) {
    const bucketKey = getHashBucketKey(entry.hash);
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey)!.push(entry);
  }

  return buckets;
}

export interface BuildDebugInfoArgs {
  currentHash: string;
  bestMatch: MatchCandidate | null;
  secondBestMatch: MatchCandidate | null;
  bestMargin: number | null;
  now: number;
  concertCount: number;
  frameCount: number;
  checkInterval: number;
  aspectRatio: AspectRatio;
  framedRegion: { width: number; height: number };
  stability: StabilityDebugInfo | null;
  similarityThreshold: number;
  recognitionDelay: number;
  frameQuality: FrameQualityInfo | null;
  telemetry: RecognitionTelemetry;
}

/**
 * Constructs a RecognitionDebugInfo snapshot from the current frame's pipeline
 * values. Pass `stability: null` on early-exit paths (e.g. quality rejection)
 * and the computed StabilityDebugInfo on the normal path.
 */
export function buildDebugInfo(args: BuildDebugInfoArgs): RecognitionDebugInfo {
  return {
    lastFrameHash: args.currentHash,
    bestMatch:
      args.bestMatch !== null
        ? {
            concert: args.bestMatch.concert,
            distance: args.bestMatch.distance,
            similarity: similarityPercent(args.bestMatch.distance),
            algorithm: 'phash',
          }
        : null,
    secondBestMatch:
      args.secondBestMatch !== null
        ? {
            concert: args.secondBestMatch.concert,
            distance: args.secondBestMatch.distance,
            similarity: similarityPercent(args.secondBestMatch.distance),
            algorithm: 'phash',
          }
        : null,
    bestMatchMargin: args.bestMargin,
    lastCheckTime: args.now,
    concertCount: args.concertCount,
    frameCount: args.frameCount,
    checkInterval: args.checkInterval,
    aspectRatio: args.aspectRatio,
    frameSize: { width: args.framedRegion.width, height: args.framedRegion.height },
    stability: args.stability,
    similarityThreshold: args.similarityThreshold,
    recognitionDelay: args.recognitionDelay,
    frameQuality: args.frameQuality,
    telemetry: args.telemetry,
    hashAlgorithm: 'phash',
  };
}

export { calculateFramedRegion } from './framing';

export function usePhotoRecognition(
  stream: MediaStream | null,
  options: PhotoRecognitionOptions = {}
): PhotoRecognitionHook {
  const {
    recognitionDelay = DEFAULT_RECOGNITION_DELAY,
    enabled = true,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    matchMarginThreshold = DEFAULT_MATCH_MARGIN_THRESHOLD,
    continuousRecognition = false,
    checkInterval = DEFAULT_CHECK_INTERVAL,
    enableDebugInfo = false,
    aspectRatio = 'auto',
    sharpnessThreshold = 100,
    glareThreshold = 250,
    glarePercentageThreshold = 20,
    minBrightness = 50,
    maxBrightness = 220,
    enableRectangleDetection = false,
    rectangleConfidenceThreshold = 0.35,
    displayAspectRatio = DEFAULT_DISPLAY_ASPECT_RATIO,
    tapIntent = null,
    tapRoiLockMs = DEFAULT_TAP_ROI_LOCK_MS,
    tapRoiDecayMs = DEFAULT_TAP_ROI_DECAY_MS,
  } = options;

  const [recognizedConcert, setRecognizedConcert] = useState<Concert | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [recognitionIndexEntries, setRecognitionIndexEntries] = useState<RecognitionIndexEntryV2[]>(
    []
  );
  const [debugInfo, setDebugInfo] = useState<RecognitionDebugInfo | null>(null);
  const [frameQuality, setFrameQuality] = useState<FrameQualityInfo | null>(null);
  const [detectedRectangle, setDetectedRectangle] = useState<DetectedRectangle | null>(null);
  const [rectangleConfidence, setRectangleConfidence] = useState(0);
  const [restartKey, setRestartKey] = useState(0);

  const telemetryRef = useRef<RecognitionTelemetry>(createEmptyTelemetry());
  const recognizedConcertRef = useRef<Concert | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const lastMatchedConcertRef = useRef<Concert | null>(null);
  const consecutiveMatchCountRef = useRef(0);
  const matchStartTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const ambientBrightnessRef = useRef<number | null>(null);
  const ambientGlarePercentageRef = useRef<number | null>(null);
  const consecutiveBlurFramesRef = useRef(0);
  const rectangleHoldFramesRef = useRef(0);
  const lastConfidentRectangleRef = useRef<DetectedRectangle | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rectangleDetectorRef = useRef<RectangleDetectionService | null>(null);
  const lastTapIntentRef = useRef<TapIntent | null>(null);
  const lastTapTimestampRef = useRef<number | null>(null);

  const resetTelemetry = useCallback(() => {
    telemetryRef.current = createEmptyTelemetry();
  }, []);

  const forceMatch = useCallback((concert: Concert) => {
    // Clear in-flight tracking refs so the pipeline doesn't continue
    // in "tracking" mode after the forced match.
    lastMatchedConcertRef.current = null;
    consecutiveMatchCountRef.current = 0;
    matchStartTimeRef.current = null;

    recognizedConcertRef.current = concert;
    setRecognizedConcert(concert);
    setIsRecognizing(false);
  }, []);

  const reset = useCallback(() => {
    recognizedConcertRef.current = null;
    lastMatchedConcertRef.current = null;
    consecutiveMatchCountRef.current = 0;
    matchStartTimeRef.current = null;
    frameCountRef.current = 0;
    ambientBrightnessRef.current = null;
    ambientGlarePercentageRef.current = null;
    consecutiveBlurFramesRef.current = 0;
    rectangleHoldFramesRef.current = 0;
    lastConfidentRectangleRef.current = null;
    lastTapIntentRef.current = null;
    lastTapTimestampRef.current = null;
    telemetryRef.current = createEmptyTelemetry();

    setRecognizedConcert(null);
    setIsRecognizing(false);
    setDebugInfo(null);
    setFrameQuality(null);
    setDetectedRectangle(null);
    setRectangleConfidence(0);
    setRestartKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!tapIntent) {
      return;
    }

    lastTapIntentRef.current = tapIntent;

    if (lastTapTimestampRef.current !== tapIntent.timestamp) {
      lastTapTimestampRef.current = tapIntent.timestamp;
      if (telemetryRef.current.tapAssist) {
        telemetryRef.current.tapAssist.tapEvents += 1;
      }
    }
  }, [tapIntent]);

  useEffect(() => {
    dataService
      .getConcerts()
      .then((loadedConcerts) => {
        setConcerts(loadedConcerts);
      })
      .catch((error) => {
        console.error('Failed to load concert data:', error);
      });
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (typeof fetch !== 'function') {
      return () => {
        isCancelled = true;
      };
    }

    fetch(RECOGNITION_INDEX_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${RECOGNITION_INDEX_URL}: HTTP ${response.status}`);
        }

        return response.json();
      })
      .then((payload: unknown) => {
        if (!isRecognitionIndexPayloadV2(payload)) {
          throw new Error(`Invalid recognition index payload: expected ${RECOGNITION_INDEX_URL}`);
        }

        if (!isCancelled) {
          setRecognitionIndexEntries(payload.entries);
        }
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        const resolvedError =
          error instanceof Error ? error : new Error(`Failed to load ${RECOGNITION_INDEX_URL}`);
        console.error('[photo-recognition] Recognition index load failed:', resolvedError);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const indexedHashData = useMemo(() => {
    if (recognitionIndexEntries.length === 0 || concerts.length === 0) {
      return {
        concertHashList: [] as Array<HashEntry>,
        eligibleConcertIds: new Set<number>(),
      };
    }

    const concertsById = new Map(concerts.map((concert) => [concert.id, concert]));
    const concertHashList: Array<HashEntry> = [];
    const eligibleConcertIds = new Set<number>();

    for (const entry of recognitionIndexEntries) {
      const concert = concertsById.get(entry.concertId);
      if (!concert) {
        continue;
      }

      const indexedConcert: Concert = {
        ...concert,
        photoHashes: {
          phash: entry.phash,
        },
      };

      const hashes = getPHashes(indexedConcert);
      if (hashes.length === 0 || hashes.length !== entry.phash.length) {
        throw new Error(
          `[photo-recognition] Invalid recognition hashes for concert ${entry.concertId}`
        );
      }

      eligibleConcertIds.add(concert.id);
      concertHashList.push(...hashes.map((hash) => ({ hash, concert })));
    }

    return { concertHashList, eligibleConcertIds };
  }, [recognitionIndexEntries, concerts]);

  const concertHashList = indexedHashData.concertHashList;

  const concertHashBuckets = useMemo(() => bucketHashEntries(concertHashList), [concertHashList]);

  const eligibleConcerts = useMemo(() => {
    return concerts.filter((concert) => indexedHashData.eligibleConcertIds.has(concert.id));
  }, [concerts, indexedHashData.eligibleConcertIds]);

  // -------------------------------------------------------------------------
  // Web Worker pipeline (off-main-thread hash computation + matching)
  // -------------------------------------------------------------------------

  /** Map concertId → Concert for resolving worker results back to Concert objects. */
  const concertsById = useMemo(() => new Map(concerts.map((c) => [c.id, c])), [concerts]);

  /** Lightweight hash entries sent to the worker (no full Concert objects). */
  const workerHashEntries: WorkerHashEntry[] = useMemo(
    () => concertHashList.map(({ hash, concert }) => ({ hash, concertId: concert.id })),
    [concertHashList]
  );

  /** Recognition + quality config forwarded to the worker. */
  const workerConfig: WorkerRecognitionConfig = useMemo(
    () => ({
      similarityThreshold,
      matchMarginThreshold,
      qualityGatingDistanceThreshold: QUALITY_GATING_DISTANCE_THRESHOLD,
      quality: {
        sharpnessThreshold,
        glareThreshold: glareThreshold ?? 250,
        glarePercentageThreshold: glarePercentageThreshold ?? 20,
        minBrightness: minBrightness ?? 50,
        maxBrightness: maxBrightness ?? 220,
      },
    }),
    [
      similarityThreshold,
      matchMarginThreshold,
      sharpnessThreshold,
      glareThreshold,
      glarePercentageThreshold,
      minBrightness,
      maxBrightness,
    ]
  );

  /**
   * Ref-based callback for worker results. The actual handler is assigned
   * inside the main useEffect so it can close over the inner helpers
   * (processQualityFilters, computeStability) and frame-scoped variables.
   */
  const workerResultHandlerRef = useRef<((result: WorkerFrameResult) => void) | null>(null);

  const handleWorkerResult = useCallback((result: WorkerFrameResult) => {
    workerResultHandlerRef.current?.(result);
  }, []);

  const {
    processFrame: workerProcessFrame,
    isReady: isWorkerReady,
    isSupported: isWorkerSupported,
  } = useRecognitionWorker({
    hashEntries: workerHashEntries,
    config: workerConfig,
    onResult: handleWorkerResult,
    enabled: enabled && eligibleConcerts.length > 0,
  });

  // isWorkerSupported is the result of feature-detection run once at mount — it
  // never changes. Storing it in a ref keeps it out of the main scheduling
  // effect's dependency array without risk of staleness.
  const isWorkerSupportedRef = useRef(isWorkerSupported);
  // isWorkerReady and workerProcessFrame change when the worker transitions to
  // ready (isReady state flip → new processFrame useCallback reference). Tracking
  // them via refs lets the scheduling effect read the latest values per-frame
  // without tearing down and recreating the video element + canvas + scheduler
  // every time the worker finishes initialising.
  const isWorkerReadyRef = useRef(false);
  isWorkerReadyRef.current = isWorkerReady;
  const workerProcessFrameRef = useRef(workerProcessFrame);
  workerProcessFrameRef.current = workerProcessFrame;

  useEffect(() => {
    if (!stream || !enabled || eligibleConcerts.length === 0) {
      return;
    }

    const video = document.createElement('video');
    videoRef.current = video;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream instanceof MediaStream ? stream : null;

    const attemptStartVideo = () => {
      if (typeof video.play !== 'function') {
        return;
      }

      try {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((error) => {
            console.warn('[photo-recognition] Unable to auto-start analysis video:', error);
          });
        }
      } catch (error) {
        console.warn('[photo-recognition] Unable to start analysis video:', error);
      }
    };

    const handleVideoCanPlay = () => {
      attemptStartVideo();
    };

    video.addEventListener('canplay', handleVideoCanPlay);
    attemptStartVideo();

    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      return;
    }

    rectangleDetectorRef.current = enableRectangleDetection
      ? new RectangleDetectionService()
      : null;

    // -----------------------------------------------------------------------
    // Worker path control
    // -----------------------------------------------------------------------
    // canUseWorkerPath is stable across the effect's lifetime — it depends only
    // on browser capability (never-changing) and requestVideoFrame availability
    // on the video element. Actual worker readiness is checked per-frame via
    // isWorkerReadyRef so the scheduling loop never restarts when the worker
    // finishes initialising.
    const canUseWorkerPath =
      isWorkerSupportedRef.current && typeof video.requestVideoFrame === 'function';

    // -----------------------------------------------------------------------
    // Inner helper: quality filtering
    // Runs sharpness, glare, and lighting checks; updates ambient refs and
    // telemetry; resets match tracking when a frame is rejected.
    // Returns { rejected: true, quality } to signal an early-exit, or
    // { rejected: false, quality } (quality may be null if check was bypassed).
    // -----------------------------------------------------------------------
    const processQualityFilters = (
      imageData: ImageData,
      shouldRunQualityCheck: boolean
    ): { rejected: boolean; quality: FrameQualityInfo | null } => {
      if (!shouldRunQualityCheck) {
        telemetryRef.current.qualityBypassFrames =
          (telemetryRef.current.qualityBypassFrames ?? 0) + 1;
        consecutiveBlurFramesRef.current = 0;
        setFrameQuality(null);
        return { rejected: false, quality: null };
      }

      // Single grayscale pass shared across all quality checks — eliminates
      // the previous 4× redundant toGrayscale() calls per frame.
      const metrics = computeAllQualityMetrics(
        imageData,
        sharpnessThreshold,
        glareThreshold,
        glarePercentageThreshold,
        minBrightness,
        maxBrightness
      );

      // Update ambient brightness EMA and recompute adaptive thresholds.
      // The initial pass above uses base thresholds; re-check glare/lighting
      // only if adaptive thresholds would differ significantly (omitted here
      // as a single-pass approximation that is accurate enough in practice).
      ambientBrightnessRef.current =
        ambientBrightnessRef.current === null
          ? metrics.averageBrightness
          : ambientBrightnessRef.current * 0.85 + metrics.averageBrightness * 0.15;

      ambientGlarePercentageRef.current =
        ambientGlarePercentageRef.current === null
          ? metrics.glarePercentage
          : ambientGlarePercentageRef.current * 0.85 + metrics.glarePercentage * 0.15;

      // Apply adaptive thresholds to make a final accept/reject decision.
      const adaptiveThresholds = calculateAdaptiveQualityThresholds(
        minBrightness,
        maxBrightness,
        glarePercentageThreshold,
        ambientBrightnessRef.current,
        ambientGlarePercentageRef.current
      );

      const hasAdaptiveGlare =
        metrics.glarePercentage > adaptiveThresholds.glarePercentageThreshold;
      const hasAdaptivePoorLighting =
        metrics.averageBrightness < adaptiveThresholds.minBrightness ||
        metrics.averageBrightness > adaptiveThresholds.maxBrightness;
      const adaptiveLightingType =
        metrics.averageBrightness < adaptiveThresholds.minBrightness
          ? ('underexposed' as const)
          : metrics.averageBrightness > adaptiveThresholds.maxBrightness
            ? ('overexposed' as const)
            : ('ok' as const);
      const sharpness = metrics.sharpness;
      const isSharp = metrics.isSharp;
      const glare = {
        glarePercentage: metrics.glarePercentage,
        hasGlare: hasAdaptiveGlare,
      };
      const lighting = {
        averageBrightness: metrics.averageBrightness,
        hasPoorLighting: hasAdaptivePoorLighting,
        type: adaptiveLightingType,
      };

      const quality: FrameQualityInfo = {
        sharpness,
        isSharp,
        glarePercentage: glare.glarePercentage,
        hasGlare: glare.hasGlare,
        averageBrightness: lighting.averageBrightness,
        hasPoorLighting: lighting.hasPoorLighting,
        lightingType: lighting.type,
      };

      setFrameQuality(quality);

      if (!quality.isSharp || quality.hasGlare || quality.hasPoorLighting) {
        if (!quality.isSharp) {
          consecutiveBlurFramesRef.current += 1;

          if (consecutiveBlurFramesRef.current < BLUR_REJECTION_CONSECUTIVE_FRAMES) {
            return { rejected: true, quality };
          }

          telemetryRef.current.blurRejections += 1;
          const tapAge =
            lastTapIntentRef.current !== null
              ? Date.now() - lastTapIntentRef.current.timestamp
              : Number.POSITIVE_INFINITY;
          if (tapAge <= tapRoiLockMs + tapRoiDecayMs && telemetryRef.current.tapAssist) {
            telemetryRef.current.tapAssist.postTapBlurRejections += 1;
          }
          recordFailure(telemetryRef.current, 'motion-blur', 'Sharpness below threshold', 'N/A');
          telemetryRef.current.frameQualityStats.blur.sharpnessSum += sharpness;
          telemetryRef.current.frameQualityStats.blur.sampleCount += 1;

          const shouldClearTracking =
            consecutiveBlurFramesRef.current >= BLUR_CLEAR_TRACKING_CONSECUTIVE_FRAMES;
          if (shouldClearTracking) {
            lastMatchedConcertRef.current = null;
            consecutiveMatchCountRef.current = 0;
            matchStartTimeRef.current = null;
          }

          setIsRecognizing(false);

          return { rejected: true, quality };
        } else if (quality.hasGlare) {
          consecutiveBlurFramesRef.current = 0;
          telemetryRef.current.glareRejections += 1;
          recordFailure(telemetryRef.current, 'glare', 'Frame has significant glare', 'N/A');
          telemetryRef.current.frameQualityStats.glare.glarePercentSum += glare.glarePercentage;
          telemetryRef.current.frameQualityStats.glare.sampleCount += 1;
        } else {
          consecutiveBlurFramesRef.current = 0;
          telemetryRef.current.lightingRejections += 1;
          recordFailure(telemetryRef.current, 'poor-quality', 'Frame has poor lighting', 'N/A');
          telemetryRef.current.frameQualityStats.lighting.brightnessSum +=
            lighting.averageBrightness;
          telemetryRef.current.frameQualityStats.lighting.sampleCount += 1;
        }

        lastMatchedConcertRef.current = null;
        consecutiveMatchCountRef.current = 0;
        matchStartTimeRef.current = null;
        setIsRecognizing(false);

        return { rejected: true, quality };
      }

      consecutiveBlurFramesRef.current = 0;
      telemetryRef.current.qualityFrames += 1;
      return { rejected: false, quality };
    };

    // -----------------------------------------------------------------------
    // Inner helper: stability progress
    // Returns a StabilityDebugInfo snapshot showing how far along the
    // recognition dwell timer is, or null when not applicable.
    // -----------------------------------------------------------------------
    const computeStability = (
      activeMatch: Concert | null,
      now: number
    ): StabilityDebugInfo | null => {
      if (!activeMatch) return null;

      if (
        matchStartTimeRef.current !== null &&
        lastMatchedConcertRef.current?.id === activeMatch.id
      ) {
        const elapsedMs = now - matchStartTimeRef.current;
        return {
          concert: activeMatch,
          elapsedMs,
          remainingMs: Math.max(recognitionDelay - elapsedMs, 0),
          requiredMs: recognitionDelay,
          progress: recognitionDelay > 0 ? Math.min(elapsedMs / recognitionDelay, 1) : 1,
        };
      }

      return null;
    };

    // -----------------------------------------------------------------------
    // Per-frame pipeline
    // -----------------------------------------------------------------------
    const checkFrame = () => {
      if (recognizedConcertRef.current && !continuousRecognition) {
        return;
      }

      if (
        !video.videoWidth ||
        !video.videoHeight ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return;
      }

      frameCountRef.current += 1;
      telemetryRef.current.totalFrames += 1;
      const frameStartAt = performance.now();
      const frameLabel = `photo-recognition:frame-${frameCountRef.current}`;
      let frameCaptureMs = 0;
      let algorithmMs = 0;
      let confirmedMatch = false;
      let comparedCandidates = 0;

      if (enableDebugInfo) {
        console.time(frameLabel);
      }

      try {
        const chosenAspectRatio: AspectRatio =
          aspectRatio === 'auto'
            ? video.videoWidth >= video.videoHeight
              ? '3:2'
              : '2:3'
            : aspectRatio;

        const visibleViewport = calculateVisibleViewport(
          video.videoWidth,
          video.videoHeight,
          displayAspectRatio
        );

        const offsetRegionToVideo = (region: ViewportRegion): ViewportRegion => ({
          x: region.x + visibleViewport.x,
          y: region.y + visibleViewport.y,
          width: region.width,
          height: region.height,
        });

        let framedRegion = offsetRegionToVideo(
          calculateFramedRegion(visibleViewport.width, visibleViewport.height, chosenAspectRatio)
        );
        const activeTap = lastTapIntentRef.current;
        const tapAgeMs = activeTap ? Date.now() - activeTap.timestamp : Number.POSITIVE_INFINITY;
        const tapWindowMs = tapRoiLockMs + tapRoiDecayMs;
        const isTapGuidanceActive =
          Boolean(activeTap) && tapAgeMs >= 0 && tapAgeMs <= tapWindowMs && tapWindowMs > 0;
        const tapLockStrength = isTapGuidanceActive
          ? tapAgeMs <= tapRoiLockMs
            ? 1
            : Math.max(0, 1 - (tapAgeMs - tapRoiLockMs) / Math.max(1, tapRoiDecayMs))
          : 0;

        if (rectangleDetectorRef.current) {
          canvas.width = visibleViewport.width;
          canvas.height = visibleViewport.height;
          context.drawImage(
            video,
            visibleViewport.x,
            visibleViewport.y,
            visibleViewport.width,
            visibleViewport.height,
            0,
            0,
            visibleViewport.width,
            visibleViewport.height
          );

          const viewportImageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const applyRectangleCrop = (rectangle: DetectedRectangle) => {
            const pixelRectangle = {
              x: Math.round(rectangle.topLeft.x * visibleViewport.width),
              y: Math.round(rectangle.topLeft.y * visibleViewport.height),
              width: Math.round(rectangle.width * visibleViewport.width),
              height: Math.round(rectangle.height * visibleViewport.height),
            };

            if (pixelRectangle.width > 0 && pixelRectangle.height > 0) {
              framedRegion = offsetRegionToVideo(pixelRectangle);
            }
          };
          const roiHint: RectangleRoiHint | null =
            isTapGuidanceActive && activeTap
              ? {
                  center: activeTap.point,
                  radius: DEFAULT_TAP_ROI_RADIUS,
                  ageMs: tapAgeMs,
                  lockStrength: tapLockStrength,
                }
              : null;

          if (roiHint && telemetryRef.current.tapAssist) {
            telemetryRef.current.tapAssist.roiGuidedFrames += 1;
          }

          const roiResult = rectangleDetectorRef.current.detectRectangle(
            viewportImageData,
            roiHint
          );
          const shouldRunFallbackPass =
            Boolean(roiHint) &&
            (!roiResult.detected || roiResult.confidence < rectangleConfidenceThreshold) &&
            frameCountRef.current % ROI_FALLBACK_FRAME_INTERVAL === 0;
          const fallbackResult = shouldRunFallbackPass
            ? rectangleDetectorRef.current.detectRectangle(viewportImageData)
            : null;
          const detectionResult =
            fallbackResult && fallbackResult.confidence > roiResult.confidence
              ? fallbackResult
              : roiResult;

          if (
            fallbackResult &&
            detectionResult === fallbackResult &&
            telemetryRef.current.tapAssist
          ) {
            telemetryRef.current.tapAssist.roiFallbackDetections += 1;
          }

          setRectangleConfidence(detectionResult.confidence);

          if (detectionResult.detected && detectionResult.rectangle) {
            setDetectedRectangle(detectionResult.rectangle);
            const meetsConfidence = detectionResult.confidence >= rectangleConfidenceThreshold;
            if (meetsConfidence) {
              lastConfidentRectangleRef.current = detectionResult.rectangle;
              rectangleHoldFramesRef.current = 0;
              applyRectangleCrop(detectionResult.rectangle);
              if (roiHint && detectionResult === roiResult && telemetryRef.current.tapAssist) {
                telemetryRef.current.tapAssist.roiAcceptedDetections += 1;
              }
            } else if (
              lastConfidentRectangleRef.current &&
              rectangleHoldFramesRef.current < RECTANGLE_CONFIDENCE_HOLD_FRAMES
            ) {
              rectangleHoldFramesRef.current += 1;
              applyRectangleCrop(lastConfidentRectangleRef.current);
            }
          } else {
            if (
              lastConfidentRectangleRef.current &&
              rectangleHoldFramesRef.current < RECTANGLE_CONFIDENCE_HOLD_FRAMES
            ) {
              rectangleHoldFramesRef.current += 1;
              setDetectedRectangle(lastConfidentRectangleRef.current);
              applyRectangleCrop(lastConfidentRectangleRef.current);
            } else {
              rectangleHoldFramesRef.current = 0;
              lastConfidentRectangleRef.current = null;
              setDetectedRectangle(null);
            }
          }
        }

        // -----------------------------------------------------------------
        // Worker path: send bitmap to worker and return immediately.
        // The result callback (workerResultHandlerRef) handles the
        // quality/stability/confirmation logic when the worker replies.
        // -----------------------------------------------------------------
        if (canUseWorkerPath && isWorkerReadyRef.current) {
          const workerFrameId = frameCountRef.current;
          const workerAspect = chosenAspectRatio;
          const workerFramedRegion = { ...framedRegion };

          createImageBitmap(
            video,
            framedRegion.x,
            framedRegion.y,
            framedRegion.width,
            framedRegion.height,
            {
              resizeWidth: 128,
              resizeHeight: 128,
            }
          )
            .then((bitmap) => {
              const sent = workerProcessFrameRef.current(bitmap, workerFrameId);
              if (!sent && enableDebugInfo) {
                console.debug('[photo-recognition] Worker busy, skipped frame', workerFrameId);
              }
            })
            .catch((err) => {
              console.warn('[photo-recognition] createImageBitmap failed:', err);
            });

          // Debug timing for the main-thread portion only
          if (enableDebugInfo) {
            const mainThreadMs = performance.now() - frameStartAt;
            console.debug('[photo-recognition] Worker frame (main-thread portion)', {
              frame: workerFrameId,
              mainThreadMs: Number(mainThreadMs.toFixed(2)),
              aspect: workerAspect,
              framedRegion: workerFramedRegion,
            });
            console.timeEnd(frameLabel);
          }
          return;
        }

        const frameCaptureStartAt = performance.now();
        // Downscale directly to 64×64 during capture so getImageData() only
        // returns 4 096 pixels instead of the full framed-region dimensions
        // (often 200 000+ pixels). The browser's canvas drawImage() performs
        // hardware-accelerated bilinear downscaling. computePHash() will then
        // resize 64×64 → 32×32, which is nearly free.
        const CAPTURE_SIZE = 64;
        canvas.width = CAPTURE_SIZE;
        canvas.height = CAPTURE_SIZE;
        context.drawImage(
          video,
          framedRegion.x,
          framedRegion.y,
          framedRegion.width,
          framedRegion.height,
          0,
          0,
          CAPTURE_SIZE,
          CAPTURE_SIZE
        );

        const imageData = context.getImageData(0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

        frameCaptureMs = performance.now() - frameCaptureStartAt;

        // Hash matching — bucketed full-image scan only
        const algorithmStartAt = performance.now();
        const currentHash = computePHash(imageData);
        comparedCandidates = 0;

        const runMatchScan = (candidates: ReadonlyArray<HashEntry>) => {
          comparedCandidates += candidates.length;
          return findBestMatches(currentHash, candidates);
        };

        telemetryRef.current.index_mode_used = (telemetryRef.current.index_mode_used ?? 0) + 1;

        const bucketCandidates = concertHashBuckets.get(getHashBucketKey(currentHash)) ?? [];

        const { bestMatch, secondBestMatch } = runMatchScan(bucketCandidates);

        algorithmMs = performance.now() - algorithmStartAt;

        const candidateTelemetry = telemetryRef.current.candidate_count_per_frame;
        if (candidateTelemetry) {
          candidateTelemetry.last = comparedCandidates;
          candidateTelemetry.frames += 1;
          candidateTelemetry.total += comparedCandidates;
          candidateTelemetry.max = Math.max(candidateTelemetry.max, comparedCandidates);
        }

        // Decision variables
        const now = Date.now();
        const activeThreshold = similarityThreshold;
        const bestMargin =
          bestMatch && secondBestMatch ? secondBestMatch.distance - bestMatch.distance : null;
        const requiredMargin = matchMarginThreshold;
        const marginBoostNearThreshold =
          bestMatch && bestMatch.distance >= Math.max(activeThreshold - 1, 0) ? 1 : 0;
        const effectiveRequiredMargin = requiredMargin + marginBoostNearThreshold;
        const hasSufficientMargin = bestMargin === null || bestMargin >= effectiveRequiredMargin;
        const isWithinThreshold = !!bestMatch && bestMatch.distance <= activeThreshold;
        const isExactCrossConcertTie =
          !!bestMatch &&
          !!secondBestMatch &&
          bestMatch.concert.id !== secondBestMatch.concert.id &&
          bestMatch.distance === secondBestMatch.distance;
        const isAmbiguousMatchCandidate =
          isWithinThreshold && (!hasSufficientMargin || isExactCrossConcertTie);
        const activeMatch =
          isWithinThreshold && hasSufficientMargin && !isExactCrossConcertTie
            ? bestMatch!.concert
            : null;

        // Quality filtering — bypassed when match distance is very low
        const shouldRunQualityCheck =
          !bestMatch || !activeMatch || bestMatch.distance > QUALITY_GATING_DISTANCE_THRESHOLD;

        // When quality checks are needed, re-capture at QUALITY_CAPTURE_SIZE so
        // that resolution-sensitive metrics (especially Laplacian variance for
        // sharpness) are not distorted by the downscaled 64×64 hash image.
        let qualityImageData = imageData;
        if (shouldRunQualityCheck) {
          canvas.width = QUALITY_CAPTURE_SIZE;
          canvas.height = QUALITY_CAPTURE_SIZE;
          context.drawImage(
            video,
            framedRegion.x,
            framedRegion.y,
            framedRegion.width,
            framedRegion.height,
            0,
            0,
            QUALITY_CAPTURE_SIZE,
            QUALITY_CAPTURE_SIZE
          );
          qualityImageData = context.getImageData(0, 0, QUALITY_CAPTURE_SIZE, QUALITY_CAPTURE_SIZE);
        }

        const { rejected, quality } = processQualityFilters(
          qualityImageData,
          shouldRunQualityCheck
        );

        if (rejected) {
          if (enableDebugInfo) {
            setDebugInfo(
              buildDebugInfo({
                currentHash,
                bestMatch,
                secondBestMatch,
                bestMargin,
                now,
                concertCount: eligibleConcerts.length,
                frameCount: frameCountRef.current,
                checkInterval,
                aspectRatio: chosenAspectRatio,
                framedRegion,
                stability: null,
                similarityThreshold,
                recognitionDelay,
                frameQuality: quality,
                telemetry: { ...telemetryRef.current },
              })
            );
          }
          return;
        }

        // Accumulate hamming distance data for quality-passing frames
        if (bestMatch !== null) {
          const dist = bestMatch.distance;
          const hdLog = telemetryRef.current.hammingDistanceLog;
          hdLog.matchedFrameDistances.count += 1;
          hdLog.matchedFrameDistances.sum += dist;
          if (hdLog.matchedFrameDistances.min === null || dist < hdLog.matchedFrameDistances.min) {
            hdLog.matchedFrameDistances.min = dist;
          }
          if (hdLog.matchedFrameDistances.max === null || dist > hdLog.matchedFrameDistances.max) {
            hdLog.matchedFrameDistances.max = dist;
          }
          // Near-miss: above the active threshold but close enough to be
          // informative for threshold tuning.
          if (dist > activeThreshold && dist <= activeThreshold + 8) {
            hdLog.nearMisses.push({
              distance: dist,
              frameHash: currentHash,
              timestamp: Date.now(),
              thresholdUsed: activeThreshold,
              mode: 'initial',
            });
            if (hdLog.nearMisses.length > 20) {
              hdLog.nearMisses.shift();
            }
          }
        }

        // Stability progress for debug overlay
        const stability = computeStability(activeMatch, now);

        if (enableDebugInfo) {
          setDebugInfo(
            buildDebugInfo({
              currentHash,
              bestMatch,
              secondBestMatch,
              bestMargin,
              now,
              concertCount: eligibleConcerts.length,
              frameCount: frameCountRef.current,
              checkInterval,
              aspectRatio: chosenAspectRatio,
              framedRegion,
              stability,
              similarityThreshold,
              recognitionDelay,
              frameQuality: quality,
              telemetry: { ...telemetryRef.current },
            })
          );
        }

        if (activeMatch) {
          const isAlreadyRecognizedConcert = recognizedConcertRef.current?.id === activeMatch.id;
          if (isAlreadyRecognizedConcert) {
            lastMatchedConcertRef.current = null;
            consecutiveMatchCountRef.current = 0;
            matchStartTimeRef.current = null;
            setIsRecognizing(false);
            return;
          }

          const isSameConcert = lastMatchedConcertRef.current?.id === activeMatch.id;
          consecutiveMatchCountRef.current = isSameConcert
            ? consecutiveMatchCountRef.current + 1
            : 1;

          const isInstantDistance = !!bestMatch && bestMatch.distance <= INSTANT_DISTANCE_THRESHOLD;
          const hasConsecutiveInstantConfidence =
            consecutiveMatchCountRef.current >= CONSECUTIVE_MATCHES_FOR_INSTANT_CONFIRM;

          if (isInstantDistance || hasConsecutiveInstantConfidence) {
            recognizedConcertRef.current = activeMatch;
            confirmedMatch = true;
            if (isInstantDistance) {
              telemetryRef.current.instantConfirmations =
                (telemetryRef.current.instantConfirmations ?? 0) + 1;
            }
            setRecognizedConcert(activeMatch);
            setIsRecognizing(false);
            telemetryRef.current.successfulRecognitions += 1;
            lastMatchedConcertRef.current = null;
            consecutiveMatchCountRef.current = 0;
            matchStartTimeRef.current = null;
            return;
          }

          if (isSameConcert) {
            if (
              matchStartTimeRef.current !== null &&
              now - matchStartTimeRef.current >= recognitionDelay
            ) {
              recognizedConcertRef.current = activeMatch;
              confirmedMatch = true;
              setRecognizedConcert(activeMatch);
              setIsRecognizing(false);
              telemetryRef.current.successfulRecognitions += 1;
              lastMatchedConcertRef.current = null;
              consecutiveMatchCountRef.current = 0;
              matchStartTimeRef.current = null;
              return;
            }
            setIsRecognizing(true);
            return;
          }

          lastMatchedConcertRef.current = activeMatch;
          matchStartTimeRef.current = now;
          setIsRecognizing(true);
          return;
        }

        if (bestMatch) {
          const isAmbiguousCollision = isAmbiguousMatchCandidate;
          const isNearThresholdNoMatch =
            !isAmbiguousCollision && bestMatch.distance <= activeThreshold + 2;

          const category: FailureCategory =
            isAmbiguousCollision || isNearThresholdNoMatch ? 'collision' : 'no-match';

          const collisionReason = isAmbiguousCollision
            ? `Ambiguous match: ${bestMatch.concert.band} vs ${secondBestMatch?.concert.band ?? 'unknown'} (margin ${bestMargin ?? 0}, required ${effectiveRequiredMargin}, distance ${bestMatch.distance}, threshold ${activeThreshold})`
            : `Near-threshold miss: ${bestMatch.concert.band} (distance ${bestMatch.distance}, threshold ${activeThreshold})`;

          if (category === 'collision') {
            recordCollisionDetails(telemetryRef.current, {
              isAmbiguous: isAmbiguousCollision,
              margin: bestMargin,
              bestBand: bestMatch.concert.band,
              secondBand: secondBestMatch?.concert.band ?? null,
            });
          }

          recordFailure(
            telemetryRef.current,
            category,
            category === 'collision'
              ? collisionReason
              : `Best match ${bestMatch.concert.band} (distance ${bestMatch.distance}, threshold ${activeThreshold})`,
            currentHash
          );
        } else {
          recordFailure(
            telemetryRef.current,
            'no-match',
            'No concerts with valid pHash',
            currentHash
          );
        }

        if (lastMatchedConcertRef.current) {
          telemetryRef.current.failedAttempts += 1;
        }
        lastMatchedConcertRef.current = null;
        consecutiveMatchCountRef.current = 0;
        matchStartTimeRef.current = null;
        setIsRecognizing(false);
      } finally {
        if (enableDebugInfo) {
          const totalPipelineMs = performance.now() - frameStartAt;
          console.debug('[photo-recognition] Frame timings', {
            frame: frameCountRef.current,
            captureMs: Number(frameCaptureMs.toFixed(2)),
            algorithmMs: Number(algorithmMs.toFixed(2)),
            totalPipelineMs: Number(totalPipelineMs.toFixed(2)),
            confirmedMatch,
            candidateComparisons: comparedCandidates,
          });
          console.timeEnd(frameLabel);
        }
      }
    };

    // -------------------------------------------------------------------
    // Worker result handler — processes async results from the recognition
    // worker using the same stability/confirmation logic as the inline path.
    // Assigned to the ref so the useRecognitionWorker callback can invoke it.
    // -------------------------------------------------------------------
    workerResultHandlerRef.current = (result: WorkerFrameResult) => {
      // Accumulate the FrameQualityInfo built during this handler so it can be
      // forwarded to the debug overlay — mirrors the inline path behaviour.
      let workerFrameQuality: FrameQualityInfo | null = null;

      // Map worker concertId results back to Concert objects
      const bestMatch: MatchCandidate | null = result.bestMatch
        ? (() => {
            const c = concertsById.get(result.bestMatch!.concertId);
            return c ? { concert: c, distance: result.bestMatch!.distance } : null;
          })()
        : null;
      const secondBestMatch: MatchCandidate | null = result.secondBestMatch
        ? (() => {
            const c = concertsById.get(result.secondBestMatch!.concertId);
            return c ? { concert: c, distance: result.secondBestMatch!.distance } : null;
          })()
        : null;

      // Decision variables (mirrors inline path logic)
      const now = Date.now();
      const activeThreshold = similarityThreshold;
      const bestMargin =
        bestMatch && secondBestMatch ? secondBestMatch.distance - bestMatch.distance : null;
      const requiredMargin = matchMarginThreshold;
      const marginBoostNearThreshold =
        bestMatch && bestMatch.distance >= Math.max(activeThreshold - 1, 0) ? 1 : 0;
      const effectiveRequiredMargin = requiredMargin + marginBoostNearThreshold;
      const hasSufficientMargin = bestMargin === null || bestMargin >= effectiveRequiredMargin;
      const isWithinThreshold = !!bestMatch && bestMatch.distance <= activeThreshold;
      const isExactCrossConcertTie =
        !!bestMatch &&
        !!secondBestMatch &&
        bestMatch.concert.id !== secondBestMatch.concert.id &&
        bestMatch.distance === secondBestMatch.distance;
      const isAmbiguousMatchCandidate =
        isWithinThreshold && (!hasSufficientMargin || isExactCrossConcertTie);
      const activeMatch =
        isWithinThreshold && hasSufficientMargin && !isExactCrossConcertTie
          ? bestMatch!.concert
          : null;

      // Quality filtering — apply adaptive thresholds on main thread
      const shouldRunQualityCheck =
        !bestMatch || !activeMatch || bestMatch.distance > QUALITY_GATING_DISTANCE_THRESHOLD;

      if (shouldRunQualityCheck && result.quality) {
        const metrics = result.quality;

        // Update ambient brightness EMA
        ambientBrightnessRef.current =
          ambientBrightnessRef.current === null
            ? metrics.averageBrightness
            : ambientBrightnessRef.current * 0.85 + metrics.averageBrightness * 0.15;
        ambientGlarePercentageRef.current =
          ambientGlarePercentageRef.current === null
            ? metrics.glarePercentage
            : ambientGlarePercentageRef.current * 0.85 + metrics.glarePercentage * 0.15;

        const adaptiveThresholds = calculateAdaptiveQualityThresholds(
          minBrightness ?? 50,
          maxBrightness ?? 220,
          glarePercentageThreshold ?? 20,
          ambientBrightnessRef.current,
          ambientGlarePercentageRef.current
        );

        const hasAdaptiveGlare =
          metrics.glarePercentage > adaptiveThresholds.glarePercentageThreshold;
        const hasAdaptivePoorLighting =
          metrics.averageBrightness < adaptiveThresholds.minBrightness ||
          metrics.averageBrightness > adaptiveThresholds.maxBrightness;
        // Re-derive lightingType from adaptive thresholds so it is consistent
        // with hasPoorLighting (the worker's lightingType uses base thresholds).
        const adaptiveLightingType: 'underexposed' | 'overexposed' | 'ok' =
          metrics.averageBrightness < adaptiveThresholds.minBrightness
            ? 'underexposed'
            : metrics.averageBrightness > adaptiveThresholds.maxBrightness
              ? 'overexposed'
              : 'ok';

        const quality: FrameQualityInfo = {
          sharpness: metrics.sharpness,
          isSharp: metrics.isSharp,
          glarePercentage: metrics.glarePercentage,
          hasGlare: hasAdaptiveGlare,
          averageBrightness: metrics.averageBrightness,
          hasPoorLighting: hasAdaptivePoorLighting,
          lightingType: adaptiveLightingType,
        };

        workerFrameQuality = quality;
        setFrameQuality(quality);

        if (!quality.isSharp || quality.hasGlare || quality.hasPoorLighting) {
          if (!quality.isSharp) {
            consecutiveBlurFramesRef.current += 1;
            if (consecutiveBlurFramesRef.current < BLUR_REJECTION_CONSECUTIVE_FRAMES) {
              return;
            }
            telemetryRef.current.blurRejections += 1;
            // Mirror inline path: postTapBlurRejections telemetry
            const tapAge =
              lastTapIntentRef.current !== null
                ? Date.now() - lastTapIntentRef.current.timestamp
                : Number.POSITIVE_INFINITY;
            if (tapAge <= tapRoiLockMs + tapRoiDecayMs && telemetryRef.current.tapAssist) {
              telemetryRef.current.tapAssist.postTapBlurRejections += 1;
            }
            recordFailure(telemetryRef.current, 'motion-blur', 'Sharpness below threshold', 'N/A');
            telemetryRef.current.frameQualityStats.blur.sharpnessSum += quality.sharpness;
            telemetryRef.current.frameQualityStats.blur.sampleCount += 1;
            // Mirror inline path: only clear tracking after BLUR_CLEAR_TRACKING_CONSECUTIVE_FRAMES
            const shouldClearTracking =
              consecutiveBlurFramesRef.current >= BLUR_CLEAR_TRACKING_CONSECUTIVE_FRAMES;
            if (shouldClearTracking) {
              lastMatchedConcertRef.current = null;
              consecutiveMatchCountRef.current = 0;
              matchStartTimeRef.current = null;
            }
            setIsRecognizing(false);
            return;
          } else if (quality.hasGlare) {
            consecutiveBlurFramesRef.current = 0;
            telemetryRef.current.glareRejections += 1;
            recordFailure(telemetryRef.current, 'glare', 'Frame has significant glare', 'N/A');
            telemetryRef.current.frameQualityStats.glare.glarePercentSum += quality.glarePercentage;
            telemetryRef.current.frameQualityStats.glare.sampleCount += 1;
          } else {
            consecutiveBlurFramesRef.current = 0;
            telemetryRef.current.lightingRejections += 1;
            recordFailure(telemetryRef.current, 'poor-quality', 'Frame has poor lighting', 'N/A');
            telemetryRef.current.frameQualityStats.lighting.brightnessSum +=
              quality.averageBrightness ?? 0;
            telemetryRef.current.frameQualityStats.lighting.sampleCount += 1;
          }

          lastMatchedConcertRef.current = null;
          consecutiveMatchCountRef.current = 0;
          matchStartTimeRef.current = null;
          setIsRecognizing(false);
          return;
        }

        consecutiveBlurFramesRef.current = 0;
        telemetryRef.current.qualityFrames += 1;
      } else if (!shouldRunQualityCheck) {
        telemetryRef.current.qualityBypassFrames =
          (telemetryRef.current.qualityBypassFrames ?? 0) + 1;
        consecutiveBlurFramesRef.current = 0;
        setFrameQuality(null);
      } else {
        // shouldRunQualityCheck is true but result.quality is null — the worker
        // skipped quality computation (e.g. config was updated between frame
        // dispatch and result delivery, causing a transient gate mismatch).
        // Reset blur tracking and clear quality display to stay consistent with
        // the quality-bypass path; the frame is still allowed to proceed to
        // match confirmation.
        consecutiveBlurFramesRef.current = 0;
        setFrameQuality(null);
      }

      // Hamming distance telemetry
      if (bestMatch !== null) {
        const dist = bestMatch.distance;
        const hdLog = telemetryRef.current.hammingDistanceLog;
        hdLog.matchedFrameDistances.count += 1;
        hdLog.matchedFrameDistances.sum += dist;
        if (hdLog.matchedFrameDistances.min === null || dist < hdLog.matchedFrameDistances.min) {
          hdLog.matchedFrameDistances.min = dist;
        }
        if (hdLog.matchedFrameDistances.max === null || dist > hdLog.matchedFrameDistances.max) {
          hdLog.matchedFrameDistances.max = dist;
        }
        if (dist > activeThreshold && dist <= activeThreshold + 8) {
          const hdLogRef = telemetryRef.current.hammingDistanceLog;
          hdLogRef.nearMisses.push({
            distance: dist,
            frameHash: result.hash,
            timestamp: Date.now(),
            thresholdUsed: activeThreshold,
            mode: 'initial',
          });
          if (hdLogRef.nearMisses.length > 20) {
            hdLogRef.nearMisses.shift();
          }
        }
      }

      // Debug info
      if (enableDebugInfo) {
        const stability = computeStability(activeMatch, now);
        setDebugInfo(
          buildDebugInfo({
            currentHash: result.hash,
            bestMatch,
            secondBestMatch,
            bestMargin,
            now,
            concertCount: eligibleConcerts.length,
            frameCount: frameCountRef.current,
            checkInterval,
            aspectRatio: aspectRatio === 'auto' ? '3:2' : aspectRatio,
            framedRegion: { width: 128, height: 128 },
            stability,
            similarityThreshold,
            recognitionDelay,
            frameQuality: workerFrameQuality,
            telemetry: { ...telemetryRef.current },
          })
        );
      }

      // Match confirmation (mirrors inline path)
      if (activeMatch) {
        const isAlreadyRecognizedConcert = recognizedConcertRef.current?.id === activeMatch.id;
        if (isAlreadyRecognizedConcert) {
          lastMatchedConcertRef.current = null;
          consecutiveMatchCountRef.current = 0;
          matchStartTimeRef.current = null;
          setIsRecognizing(false);
          return;
        }

        const isSameConcert = lastMatchedConcertRef.current?.id === activeMatch.id;
        consecutiveMatchCountRef.current = isSameConcert ? consecutiveMatchCountRef.current + 1 : 1;

        const isInstantDistance = !!bestMatch && bestMatch.distance <= INSTANT_DISTANCE_THRESHOLD;
        const hasConsecutiveInstantConfidence =
          consecutiveMatchCountRef.current >= CONSECUTIVE_MATCHES_FOR_INSTANT_CONFIRM;

        if (isInstantDistance || hasConsecutiveInstantConfidence) {
          recognizedConcertRef.current = activeMatch;
          if (isInstantDistance) {
            telemetryRef.current.instantConfirmations =
              (telemetryRef.current.instantConfirmations ?? 0) + 1;
          }
          setRecognizedConcert(activeMatch);
          setIsRecognizing(false);
          telemetryRef.current.successfulRecognitions += 1;
          lastMatchedConcertRef.current = null;
          consecutiveMatchCountRef.current = 0;
          matchStartTimeRef.current = null;
          return;
        }

        if (isSameConcert) {
          if (
            matchStartTimeRef.current !== null &&
            now - matchStartTimeRef.current >= recognitionDelay
          ) {
            recognizedConcertRef.current = activeMatch;
            setRecognizedConcert(activeMatch);
            setIsRecognizing(false);
            telemetryRef.current.successfulRecognitions += 1;
            lastMatchedConcertRef.current = null;
            consecutiveMatchCountRef.current = 0;
            matchStartTimeRef.current = null;
            return;
          }
          setIsRecognizing(true);
          return;
        }

        lastMatchedConcertRef.current = activeMatch;
        matchStartTimeRef.current = now;
        setIsRecognizing(true);
        return;
      }

      // No active match — record failure
      if (bestMatch) {
        const isAmbiguousCollision = isAmbiguousMatchCandidate;
        const isNearThresholdNoMatch =
          !isAmbiguousCollision && bestMatch.distance <= activeThreshold + 2;

        const category: FailureCategory =
          isAmbiguousCollision || isNearThresholdNoMatch ? 'collision' : 'no-match';

        if (category === 'collision') {
          recordCollisionDetails(telemetryRef.current, {
            isAmbiguous: isAmbiguousCollision,
            margin: bestMargin,
            bestBand: bestMatch.concert.band,
            secondBand: secondBestMatch?.concert.band ?? null,
          });
        }

        recordFailure(
          telemetryRef.current,
          category,
          category === 'collision'
            ? `Ambiguous match: ${bestMatch.concert.band} vs ${secondBestMatch?.concert.band ?? 'unknown'}`
            : `Best match ${bestMatch.concert.band} (distance ${bestMatch.distance})`,
          result.hash
        );
      } else {
        recordFailure(
          telemetryRef.current,
          'no-match',
          'No concerts with valid pHash',
          result.hash
        );
      }

      if (lastMatchedConcertRef.current) {
        telemetryRef.current.failedAttempts += 1;
      }
      lastMatchedConcertRef.current = null;
      consecutiveMatchCountRef.current = 0;
      matchStartTimeRef.current = null;
      setIsRecognizing(false);
    };

    // -------------------------------------------------------------------
    // Dual-path scheduling
    // -------------------------------------------------------------------
    let rVFHandle: number | undefined;

    if (canUseWorkerPath) {
      // requestVideoFrame-based scheduling — fires exactly when new video
      // frames are presented, avoiding duplicate processing and enabling
      // higher effective frame rates than setTimeout polling.
      // canUseWorkerPath (not isWorkerReadyRef) gates scheduling so that
      // requestVideoFrame is set up immediately; checkFrame decides at runtime
      // whether to route each frame to the worker or inline path.
      let workerFrameSkip = 0;
      const onVideoFrame = () => {
        // Idle throttle: skip every other frame when not tracking a candidate.
        const isTracking = lastMatchedConcertRef.current !== null;
        workerFrameSkip += 1;
        if (!isTracking && workerFrameSkip % 2 !== 0) {
          rVFHandle = video.requestVideoFrame(onVideoFrame);
          return;
        }
        checkFrame();
        rVFHandle = video.requestVideoFrame(onVideoFrame);
      };
      rVFHandle = video.requestVideoFrame(onVideoFrame);
    } else {
      // Adaptive setTimeout scheduling (existing fallback path).
      // A fixed checkInterval (non-default) overrides this for test compatibility.
      const scheduleNext = () => {
        const isTracking = lastMatchedConcertRef.current !== null;
        const delay =
          checkInterval !== DEFAULT_CHECK_INTERVAL ? checkInterval : isTracking ? 80 : 120;
        intervalRef.current = window.setTimeout(() => {
          checkFrame();
          scheduleNext();
        }, delay);
      };
      scheduleNext();
    }

    return () => {
      workerResultHandlerRef.current = null;

      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = undefined;
      }

      if (
        rVFHandle !== undefined &&
        video &&
        typeof video.cancelVideoFrameCallback === 'function'
      ) {
        video.cancelVideoFrameCallback(rVFHandle);
      }

      if (videoRef.current) {
        videoRef.current.removeEventListener('canplay', handleVideoCanPlay);
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, [
    stream,
    enabled,
    eligibleConcerts,
    concertHashList,
    concertHashBuckets,
    concertsById,
    checkInterval,
    recognitionDelay,
    similarityThreshold,
    matchMarginThreshold,
    continuousRecognition,
    aspectRatio,
    sharpnessThreshold,
    glareThreshold,
    glarePercentageThreshold,
    minBrightness,
    maxBrightness,
    enableDebugInfo,
    enableRectangleDetection,
    rectangleConfidenceThreshold,
    displayAspectRatio,
    tapRoiLockMs,
    tapRoiDecayMs,
    restartKey,
    // isWorkerSupported, isWorkerReady, workerProcessFrame are intentionally
    // omitted: all three are accessed via refs (isWorkerSupportedRef,
    // isWorkerReadyRef, workerProcessFrameRef) so the scheduler never restarts
    // — and never recreates the video/canvas — when the worker transitions to
    // ready or its processFrame reference changes.
  ]);

  return {
    recognizedConcert,
    isRecognizing,
    reset,
    resetTelemetry,
    forceMatch,
    debugInfo,
    frameQuality,
    detectedRectangle,
    rectangleConfidence,
  };
}
