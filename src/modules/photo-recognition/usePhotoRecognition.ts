import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { dataService } from '../../services/data-service';
import { useFeatureFlags } from '../secret-settings';
import { RectangleDetectionService } from '../photo-rectangle-detection';
import type { DetectedRectangle } from '../photo-rectangle-detection';
import type { Concert } from '../../types';
import type {
  PhotoRecognitionHook,
  PhotoRecognitionOptions,
  RecognitionDebugInfo,
  AspectRatio,
  FrameQualityInfo,
  RecognitionTelemetry,
  FailureCategory,
  FailureDiagnostic,
  HashAlgorithm,
  GuidanceType,
} from './types';
import { computeDHash } from './algorithms/dhash';
import { computePHash } from './algorithms/phash';
import { hammingDistance } from './algorithms/hamming';
import {
  convertToGrayscale,
  computeLaplacianVariance,
  detectGlare,
  detectPoorLighting,
} from './algorithms/utils';

const HASH_LENGTHS: Record<HashAlgorithm, number> = {
  dhash: 32,
  phash: 16,
};

const DEFAULT_THRESHOLDS: Record<HashAlgorithm, number> = {
  dhash: 24,
  phash: 12,
};

const maxDistanceForAlgorithm = (algorithm: HashAlgorithm): number => HASH_LENGTHS[algorithm] * 4;

const similarityPercent = (distance: number, algorithm: HashAlgorithm): number => {
  const max = maxDistanceForAlgorithm(algorithm);
  return ((max - distance) / max) * 100;
};

const normalizeLegacyHashes = (hash: string | string[] | undefined): string[] => {
  if (!hash) {
    return [];
  }
  const hashes = Array.isArray(hash) ? hash : [hash];
  return hashes.filter((value) => typeof value === 'string' && value.length > 0);
};

const isValidForAlgorithm = (hashes: string[], algorithm: HashAlgorithm): boolean => {
  if (hashes.length === 0) {
    return false;
  }
  const expectedLength = HASH_LENGTHS[algorithm];
  return hashes.every((value) => value.length === expectedLength);
};

const getPhotoHashesForAlgorithm = (concert: Concert, algorithm: HashAlgorithm): string[] => {
  const hashSet = concert.photoHashes?.[algorithm];
  if (Array.isArray(hashSet) && hashSet.length > 0 && isValidForAlgorithm(hashSet, algorithm)) {
    return hashSet;
  }

  // Legacy photoHash field fallback - currently mirrors pHash values (16 chars)
  // This fallback only works correctly for pHash algorithm; dHash will get empty array
  const legacyHashes = normalizeLegacyHashes(concert.photoHash);
  if (isValidForAlgorithm(legacyHashes, algorithm)) {
    return legacyHashes;
  }

  return [];
};

const hasPhotoHashesForAlgorithm = (concert: Concert, algorithm: HashAlgorithm): boolean =>
  getPhotoHashesForAlgorithm(concert, algorithm).length > 0;

/**
 * Record a recognition failure in telemetry
 */
const recordFailure = (
  telemetry: RecognitionTelemetry,
  category: FailureCategory,
  reason: string,
  frameHash: string
): void => {
  // Increment category counter
  telemetry.failureByCategory[category] += 1;

  // Add to failure history (keep last 10)
  const diagnostic: FailureDiagnostic = {
    category,
    reason,
    frameHash,
    timestamp: Date.now(),
  };

  telemetry.failureHistory.push(diagnostic);
  if (telemetry.failureHistory.length > 10) {
    telemetry.failureHistory.shift(); // Remove oldest
  }
};

/**
 * Calculate the framed region coordinates based on aspect ratio
 * @param videoWidth - Width of the video in pixels
 * @param videoHeight - Height of the video in pixels
 * @param aspectRatio - Target aspect ratio ('3:2' or '2:3')
 * @param scale - Scale factor for the frame size (default 0.8 = 80% of viewport)
 * @returns Coordinates for cropping {x, y, width, height}
 */
export function calculateFramedRegion(
  videoWidth: number,
  videoHeight: number,
  aspectRatio: AspectRatio,
  scale: number = 0.8
): { x: number; y: number; width: number; height: number } {
  const targetRatio = aspectRatio === '3:2' ? 3 / 2 : 2 / 3;
  const videoRatio = videoWidth / videoHeight;

  let frameWidth: number;
  let frameHeight: number;

  if (videoRatio > targetRatio) {
    // Video is wider than target - fit height, crop width
    frameHeight = videoHeight * scale;
    frameWidth = frameHeight * targetRatio;
  } else {
    // Video is taller than target - fit width, crop height
    frameWidth = videoWidth * scale;
    frameHeight = frameWidth / targetRatio;
  }

  const x = (videoWidth - frameWidth) / 2;
  const y = (videoHeight - frameHeight) / 2;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(frameWidth),
    height: Math.round(frameHeight),
  };
}

/**
 * Custom hook for photo recognition using perceptual hashing (dHash)
 *
 * Uses dHash algorithm to generate fingerprints of camera frames and
 * compares them with pre-computed hashes of reference photos to identify matches.
 *
 * @param stream - Camera video stream
 * @param options - Configuration options
 * @returns Recognition state and controls
 */
export function usePhotoRecognition(
  stream: MediaStream | null,
  options: PhotoRecognitionOptions = {}
): PhotoRecognitionHook {
  const {
    recognitionDelay = 3000,
    enabled = true,
    similarityThreshold = 40,
    checkInterval = 1000,
    enableDebugInfo = false,
    aspectRatio = '3:2',
    sharpnessThreshold = 100,
    glareThreshold = 250,
    glarePercentageThreshold = 20,
    minBrightness = 50,
    maxBrightness = 220,
    hashAlgorithm = 'dhash',
    enableMultiScale = false,
    multiScaleVariants = [0.75, 0.8, 0.85, 0.9],
    enableRectangleDetection = false,
    rectangleConfidenceThreshold = 0.6,
    secondaryHashAlgorithm = null,
    secondarySimilarityThreshold,
  } = options;

  const { isEnabled } = useFeatureFlags();

  // Memoize multiScaleVariants to prevent unnecessary re-renders
  // This ensures the array reference is stable unless the actual values change
  const stableMultiScaleVariants = useMemo(
    () => multiScaleVariants,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [multiScaleVariants.join(',')]
  );

  const resolvedSecondaryHashAlgorithm =
    secondaryHashAlgorithm && secondaryHashAlgorithm !== hashAlgorithm
      ? secondaryHashAlgorithm
      : null;

  const resolvedSecondaryThreshold =
    resolvedSecondaryHashAlgorithm && resolvedSecondaryHashAlgorithm in DEFAULT_THRESHOLDS
      ? (secondarySimilarityThreshold ?? DEFAULT_THRESHOLDS[resolvedSecondaryHashAlgorithm])
      : secondarySimilarityThreshold;

  const [recognizedConcert, setRecognizedConcert] = useState<Concert | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [debugInfo, setDebugInfo] = useState<RecognitionDebugInfo | null>(null);
  const [frameQuality, setFrameQuality] = useState<FrameQualityInfo | null>(null);
  const [activeGuidance, setActiveGuidance] = useState<GuidanceType>('none');
  const [restartKey, setRestartKey] = useState(0);
  const [detectedRectangle, setDetectedRectangle] = useState<DetectedRectangle | null>(null);
  const [rectangleConfidence, setRectangleConfidence] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null); // Reusable temp canvas for multi-scale
  const rectangleDetectorRef = useRef<RectangleDetectionService | null>(null); // Rectangle detection service
  const intervalRef = useRef<number | undefined>(undefined);
  const lastMatchedConcertRef = useRef<Concert | null>(null);
  const matchStartTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const telemetryDispatchRef = useRef<number>(0);

  // Telemetry tracking
  const telemetryRef = useRef<RecognitionTelemetry>({
    totalFrames: 0,
    blurRejections: 0,
    glareRejections: 0,
    lightingRejections: 0,
    qualityFrames: 0,
    successfulRecognitions: 0,
    failedAttempts: 0,
    failureHistory: [],
    failureByCategory: {
      'motion-blur': 0,
      glare: 0,
      'poor-quality': 0,
      'no-match': 0,
      collision: 0,
      unknown: 0,
    },
    guidanceTracking: {
      shown: {
        'motion-blur': 0,
        glare: 0,
        'poor-lighting': 0,
        distance: 0,
        'off-center': 0,
        none: 0,
      },
      duration: {
        'motion-blur': 0,
        glare: 0,
        'poor-lighting': 0,
        distance: 0,
        'off-center': 0,
        none: 0,
      },
      lastShown: {
        'motion-blur': 0,
        glare: 0,
        'poor-lighting': 0,
        distance: 0,
        'off-center': 0,
        none: 0,
      },
    },
  });

  // Track previous guidance state for duration tracking
  const previousGuidanceRef = useRef<GuidanceType>('none');
  const guidanceStartTimeRef = useRef<number>(Date.now());

  // Emit lightweight on-device telemetry so we can monitor blur/glare rejection rates in real time
  const emitTelemetrySnapshot = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const now = Date.now();
    // Avoid spamming; emit at most once per second
    if (now - telemetryDispatchRef.current < 1000) {
      return;
    }

    const { totalFrames, blurRejections, glareRejections } = telemetryRef.current;
    if (totalFrames === 0) {
      return;
    }

    const blurRate = blurRejections / totalFrames;
    const glareRate = glareRejections / totalFrames;

    telemetryDispatchRef.current = now;

    try {
      window.dispatchEvent(
        new CustomEvent('photo-recognition-telemetry', {
          detail: {
            totalFrames,
            blurRejections,
            glareRejections,
            blurRate,
            glareRate,
            timestamp: now,
          },
        })
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[Photo Recognition] Failed to dispatch telemetry event', error);
      }
    }

    if (import.meta.env.DEV || isEnabled('test-mode')) {
      const blurPct = (blurRate * 100).toFixed(1);
      const glarePct = (glareRate * 100).toFixed(1);
      console.debug(
        `[Photo Recognition][Telemetry] Frames=${totalFrames} Blur=${blurRejections} (${blurPct}%) Glare=${glareRejections} (${glarePct}%)`
      );
    }
  }, [isEnabled]);

  // Load concert data
  const loadConcerts = useCallback(() => {
    dataService
      .getConcerts()
      .then(setConcerts)
      .catch((error) => {
        console.error('Failed to load concert data:', error);
        setConcerts([]);
      });
  }, []);

  // Load concerts on mount and when data source changes
  useEffect(() => {
    loadConcerts();

    // Subscribe to data source changes
    const unsubscribe = dataService.subscribe(() => {
      loadConcerts();
    });

    return unsubscribe;
  }, [loadConcerts]);

  // Reset recognition state
  const reset = useCallback(() => {
    setRecognizedConcert(null);
    setIsRecognizing(false);
    setDebugInfo(null);
    setFrameQuality(null);
    setActiveGuidance('none');
    lastMatchedConcertRef.current = null;
    matchStartTimeRef.current = null;
    frameCountRef.current = 0;
    telemetryDispatchRef.current = 0;
    previousGuidanceRef.current = 'none';
    guidanceStartTimeRef.current = Date.now();
    telemetryRef.current = {
      totalFrames: 0,
      blurRejections: 0,
      glareRejections: 0,
      lightingRejections: 0,
      qualityFrames: 0,
      successfulRecognitions: 0,
      failedAttempts: 0,
      failureHistory: [],
      failureByCategory: {
        'motion-blur': 0,
        glare: 0,
        'poor-quality': 0,
        'no-match': 0,
        collision: 0,
        unknown: 0,
      },
      guidanceTracking: {
        shown: {
          'motion-blur': 0,
          glare: 0,
          'poor-lighting': 0,
          distance: 0,
          'off-center': 0,
          none: 0,
        },
        duration: {
          'motion-blur': 0,
          glare: 0,
          'poor-lighting': 0,
          distance: 0,
          'off-center': 0,
          none: 0,
        },
        lastShown: {
          'motion-blur': 0,
          glare: 0,
          'poor-lighting': 0,
          distance: 0,
          'off-center': 0,
          none: 0,
        },
      },
    };
    setRestartKey((key) => key + 1);
  }, []);

  // Start recognition when stream is available
  useEffect(() => {
    if (!stream || !enabled || concerts.length === 0) {
      return;
    }

    // Log initialization in dev mode or if Test Mode is enabled
    const isTestMode = isEnabled('test-mode');
    if (import.meta.env.DEV || isTestMode) {
      console.log('━'.repeat(60));
      console.log('[Photo Recognition] Initializing recognition system');
      console.log(`  Concerts loaded: ${concerts.length}`);
      const concertsWithHashes = concerts.filter((concert) =>
        hasPhotoHashesForAlgorithm(concert, hashAlgorithm)
      );
      console.log(`  Concerts with hashes: ${concertsWithHashes.length}`);
      console.log(
        `  Similarity threshold (${hashAlgorithm}): ${similarityThreshold} (≥${similarityPercent(similarityThreshold, hashAlgorithm).toFixed(1)}% match)`
      );
      if (resolvedSecondaryHashAlgorithm) {
        const secondaryThresholdValue =
          resolvedSecondaryThreshold ?? DEFAULT_THRESHOLDS[resolvedSecondaryHashAlgorithm];
        console.log(
          `  Secondary threshold (${resolvedSecondaryHashAlgorithm}): ${secondaryThresholdValue} (≥${similarityPercent(secondaryThresholdValue, resolvedSecondaryHashAlgorithm).toFixed(1)}% match)`
        );
      }
      console.log(`  Recognition delay: ${recognitionDelay}ms`);
      console.log(`  Check interval: ${checkInterval}ms`);
      console.log(`  Aspect ratio: ${aspectRatio}`);
      console.log(
        `  Hash algorithm: ${hashAlgorithm.toUpperCase()}${resolvedSecondaryHashAlgorithm ? ` (secondary: ${resolvedSecondaryHashAlgorithm.toUpperCase()})` : ''}`
      );
      console.log(
        `  Multi-scale recognition: ${enableMultiScale ? `ENABLED (scales: ${stableMultiScaleVariants.map((s) => `${(s * 100).toFixed(0)}%`).join(', ')})` : 'DISABLED'}`
      );
      console.log(`  Test Mode: ${isTestMode ? 'ON' : 'OFF'}`);
      if (concertsWithHashes.length > 0) {
        console.log('\n  Available hashes:');
        concertsWithHashes.forEach((concert) => {
          const hashes = getPhotoHashesForAlgorithm(concert, hashAlgorithm);
          if (hashes.length > 1) {
            console.log(`    ${concert.band}: ${hashes.length} exposure variants`);
            hashes.forEach((hash, idx) => {
              const exposureLabels = ['dark', 'normal', 'bright'];
              const exposureLabel = exposureLabels[idx] ?? `variant ${idx + 1}`;
              console.log(`      [${exposureLabel}] ${hash}`);
            });
          } else if (hashes.length === 1) {
            console.log(`    ${concert.band}: ${hashes[0]}`);
          }
        });
      }
      console.log('━'.repeat(60) + '\n');
    }

    // Create video element to capture stream
    const video = document.createElement('video');

    // Try to set srcObject, catch if it fails in test environment
    try {
      video.srcObject = stream;
    } catch (error) {
      // In test environment, this might fail if stream is not a true MediaStream
      if (import.meta.env.MODE === 'test') {
        console.warn('Failed to set video srcObject in test environment:', error);
        return;
      }
      // In production, propagate the error
      throw error;
    }

    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;

    // Wait for video to be ready
    const handleLoadedMetadata = () => {
      video.play().catch((error) => {
        console.error('Failed to play video:', error);
      });
    };
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Create canvas for frame extraction
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

    // Initialize rectangle detector if enabled
    if (enableRectangleDetection && !rectangleDetectorRef.current) {
      rectangleDetectorRef.current = new RectangleDetectionService({
        minArea: 0.1,
        maxArea: 0.9,
        minAspectRatio: 0.5,
        maxAspectRatio: 2.5,
        minConfidence: 0.6,
      });
    }

    /**
     * Check current video frame for photo match
     */
    const checkFrame = () => {
      if (!video.videoWidth || !video.videoHeight) {
        // Video not ready yet
        return;
      }

      // If already recognized, don't check anymore
      if (recognizedConcert) {
        return;
      }

      try {
        frameCountRef.current += 1;
        const currentTime = Date.now();
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const isTestMode = isEnabled('test-mode');
        const scaleImageDataMap = new Map<number, ImageData>();
        const scaleRegionMap = new Map<
          number,
          { x: number; y: number; width: number; height: number }
        >();

        // Extract current frame
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          console.error('Failed to get canvas context');
          return;
        }

        // Optional: Detect rectangle in frame (when enabled)
        let finalFramedRegion = calculateFramedRegion(
          video.videoWidth,
          video.videoHeight,
          aspectRatio
        );

        if (enableRectangleDetection && rectangleDetectorRef.current) {
          // First, capture the full frame for rectangle detection
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const fullFrameData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Detect rectangle in full frame
          const detectionResult = rectangleDetectorRef.current.detectRectangle(fullFrameData);
          const meetsConfidence = detectionResult.confidence >= rectangleConfidenceThreshold;

          // Update detection state for UI
          setDetectedRectangle(detectionResult.rectangle);
          setRectangleConfidence(detectionResult.confidence);

          // If rectangle detected with good confidence, use it instead of fixed aspect ratio
          if (detectionResult.detected && detectionResult.rectangle && meetsConfidence) {
            const rect = detectionResult.rectangle;
            // Convert normalized coordinates to pixel coordinates
            finalFramedRegion = {
              x: Math.round(rect.topLeft.x * video.videoWidth),
              y: Math.round(rect.topLeft.y * video.videoHeight),
              width: Math.round(rect.width * video.videoWidth),
              height: Math.round(rect.height * video.videoHeight),
            };
          } else {
            // No rectangle detected, use fixed aspect ratio framing
            setDetectedRectangle(null);
            setRectangleConfidence(0);
          }
        }

        // Use detected rectangle region or fallback to fixed aspect ratio
        const framedRegion = finalFramedRegion;

        // Set canvas to cropped region size
        canvas.width = framedRegion.width;
        canvas.height = framedRegion.height;

        // Draw only the framed region to canvas
        ctx.drawImage(
          video,
          framedRegion.x,
          framedRegion.y,
          framedRegion.width,
          framedRegion.height,
          0,
          0,
          framedRegion.width,
          framedRegion.height
        );

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Phase 1: Check frame quality (sharpness and glare detection)
        telemetryRef.current.totalFrames += 1;

        // Check sharpness (motion blur detection)
        const sharpness = computeLaplacianVariance(imageData);
        const isSharp = sharpness >= sharpnessThreshold;

        // Check for glare
        const glareDetection = detectGlare(imageData, glareThreshold, glarePercentageThreshold);
        const { hasGlare, glarePercentage } = glareDetection;

        // Check for poor lighting
        const lightingDetection = detectPoorLighting(imageData, minBrightness, maxBrightness);
        const { hasPoorLighting, averageBrightness, type: lightingType } = lightingDetection;

        // Determine active guidance based on detected issues (priority order)
        let currentGuidance: GuidanceType = 'none';
        if (!isSharp) {
          currentGuidance = 'motion-blur';
        } else if (hasGlare) {
          currentGuidance = 'glare';
        } else if (hasPoorLighting) {
          currentGuidance = 'poor-lighting';
        }

        // Track guidance telemetry
        const now = Date.now();
        const previousGuidance = previousGuidanceRef.current;

        // If guidance changed, update duration for previous guidance
        if (previousGuidance !== currentGuidance) {
          const duration = now - guidanceStartTimeRef.current;
          telemetryRef.current.guidanceTracking.duration[previousGuidance] += duration;
          guidanceStartTimeRef.current = now;
          previousGuidanceRef.current = currentGuidance;

          // Track when guidance is shown (not 'none')
          if (currentGuidance !== 'none') {
            telemetryRef.current.guidanceTracking.shown[currentGuidance] += 1;
            telemetryRef.current.guidanceTracking.lastShown[currentGuidance] = now;
          }
        }

        setActiveGuidance(currentGuidance);

        // Update frame quality state for UI feedback
        const currentFrameQuality: FrameQualityInfo = {
          sharpness,
          isSharp,
          glarePercentage,
          hasGlare,
          averageBrightness,
          hasPoorLighting,
          lightingType,
        };
        setFrameQuality(currentFrameQuality);

        // Log frame quality in Test Mode
        if (isTestMode) {
          console.debug(`\nFrame Quality Check:`);
          console.debug(`  Sharpness: ${sharpness.toFixed(1)} (threshold: ${sharpnessThreshold})`);
          console.debug(`  ${isSharp ? '✓' : '✗'} Sharp enough: ${isSharp}`);
          console.debug(
            `  Glare: ${glarePercentage.toFixed(1)}% (threshold: ${glarePercentageThreshold}%)`
          );
          console.debug(`  ${hasGlare ? '✗' : '✓'} Glare detected: ${hasGlare}`);
          console.debug(
            `  Brightness: ${averageBrightness.toFixed(1)} (range: ${minBrightness}-${maxBrightness})`
          );
          console.debug(
            `  ${hasPoorLighting ? '✗' : '✓'} Lighting: ${lightingType} ${hasPoorLighting ? '(poor)' : '(ok)'}`
          );
          console.debug(`  Active Guidance: ${currentGuidance}`);
        }

        // Skip frame if it fails quality checks
        if (!isSharp) {
          telemetryRef.current.blurRejections += 1;
          // Record diagnostic with placeholder hash (not computed yet for blurry frames)
          recordFailure(
            telemetryRef.current,
            'motion-blur',
            `Sharpness ${sharpness.toFixed(1)} below threshold ${sharpnessThreshold}`,
            'N/A'
          );
          if (isTestMode) {
            console.debug(`❌ Frame REJECTED: Too blurry (motion blur detected)`);
            console.debug(
              `   Telemetry: ${telemetryRef.current.blurRejections} blur rejections / ${telemetryRef.current.totalFrames} total frames`
            );
            console.debug(`   Failure Category: motion-blur`);
          }
          emitTelemetrySnapshot();
          return; // Skip hashing for blurry frames
        }

        if (hasGlare) {
          telemetryRef.current.glareRejections += 1;
          // Record diagnostic with placeholder hash
          recordFailure(
            telemetryRef.current,
            'glare',
            `${glarePercentage.toFixed(1)}% of frame blown out (threshold: ${glarePercentageThreshold}%)`,
            'N/A'
          );
          if (isTestMode) {
            console.debug(
              `❌ Frame REJECTED: Excessive glare (${glarePercentage.toFixed(1)}% blown out)`
            );
            console.debug(
              `   Telemetry: ${telemetryRef.current.glareRejections} glare rejections / ${telemetryRef.current.totalFrames} total frames`
            );
            console.debug(`   Failure Category: glare`);
          }
          emitTelemetrySnapshot();
          return; // Skip hashing for frames with glare
        }

        // Frame passed quality checks
        telemetryRef.current.qualityFrames += 1;
        if (isTestMode) {
          console.debug(`✓ Frame PASSED quality checks`);
          console.debug(
            `  Telemetry: ${telemetryRef.current.qualityFrames} quality frames / ${telemetryRef.current.totalFrames} total`
          );
        }

        // Apply grayscale conversion if enabled
        if (isEnabled('grayscale-mode')) {
          convertToGrayscale(imageData);
        }

        // Cache primary scale image data/region for potential secondary hashing
        scaleImageDataMap.set(0.8, imageData);
        scaleRegionMap.set(0.8, framedRegion);

        // Compute hash of current frame using selected algorithm
        const currentHash =
          hashAlgorithm === 'phash' ? computePHash(imageData) : computeDHash(imageData);

        // Multi-scale recognition: determine which scales to test
        // If multi-scale is enabled, use user's custom variants; otherwise just test default scale (0.8)
        const scalesToTest = enableMultiScale ? stableMultiScaleVariants : [0.8];
        const scaleHashes: Array<{ hash: string; scale: number; region: typeof framedRegion }> = [];

        for (const scale of scalesToTest) {
          // If scale is 0.8, we can reuse the current frame and hash (already computed)
          if (scale === 0.8) {
            scaleHashes.push({ hash: currentHash, scale, region: framedRegion });
            continue;
          }

          // Calculate the scaled region
          const scaledRegion = calculateFramedRegion(
            video.videoWidth,
            video.videoHeight,
            aspectRatio,
            scale
          );

          // Reuse temp canvas to avoid creating new canvas elements in every iteration
          if (!tempCanvasRef.current) {
            tempCanvasRef.current = document.createElement('canvas');
          }
          const tempCanvas = tempCanvasRef.current;
          tempCanvas.width = scaledRegion.width;
          tempCanvas.height = scaledRegion.height;

          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

          if (tempCtx) {
            // Draw the scaled region
            tempCtx.drawImage(
              video,
              scaledRegion.x,
              scaledRegion.y,
              scaledRegion.width,
              scaledRegion.height,
              0,
              0,
              scaledRegion.width,
              scaledRegion.height
            );

            const scaledImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

            // Apply grayscale if enabled
            if (isEnabled('grayscale-mode')) {
              convertToGrayscale(scaledImageData);
            }

            // Cache scaled image data/region for potential secondary hashing
            scaleImageDataMap.set(scale, scaledImageData);
            scaleRegionMap.set(scale, scaledRegion);

            // Compute hash for this scale
            const scaledHash =
              hashAlgorithm === 'phash'
                ? computePHash(scaledImageData)
                : computeDHash(scaledImageData);

            scaleHashes.push({ hash: scaledHash, scale, region: scaledRegion });
          } else {
            // Log when a scale is skipped due to context creation failure
            if (import.meta.env.DEV || isTestMode) {
              console.debug(
                `[Photo Recognition] Skipped scale ${(scale * 100).toFixed(0)}% (region: ${scaledRegion.width}x${scaledRegion.height}) - could not create 2D context for temporary canvas`
              );
            }
          }
        }

        // Enhanced logging in dev mode or Test Mode
        // Using console.debug() for frame-level logs (can be filtered in DevTools)
        const concertsWithHashes = concerts.filter((concert) =>
          hasPhotoHashesForAlgorithm(concert, hashAlgorithm)
        );
        const concertsWithSecondaryHashes =
          resolvedSecondaryHashAlgorithm && resolvedSecondaryHashAlgorithm !== hashAlgorithm
            ? concerts.filter((concert) =>
                hasPhotoHashesForAlgorithm(concert, resolvedSecondaryHashAlgorithm)
              )
            : [];

        const secondaryThreshold =
          resolvedSecondaryHashAlgorithm && resolvedSecondaryHashAlgorithm in DEFAULT_THRESHOLDS
            ? (resolvedSecondaryThreshold ?? DEFAULT_THRESHOLDS[resolvedSecondaryHashAlgorithm])
            : resolvedSecondaryThreshold;

        const logThreshold = (algorithm: HashAlgorithm, threshold: number | undefined) => {
          if (threshold === undefined) {
            return 'n/a';
          }
          const similarity = similarityPercent(threshold, algorithm).toFixed(1);
          return `${threshold} (similarity ≥ ${similarity}%)`;
        };

        if (import.meta.env.DEV || isTestMode) {
          console.debug(`\n${'='.repeat(60)}`);
          console.debug(`[Photo Recognition] FRAME ${frameCountRef.current} @ ${timestamp}`);
          console.debug(`Frame Hash (${hashAlgorithm}): ${currentHash}`);
          console.debug(`Frame Size: ${canvas.width} × ${canvas.height} px (cropped)`);
          console.debug(
            `Cropped Region: x=${framedRegion.x}, y=${framedRegion.y}, w=${framedRegion.width}, h=${framedRegion.height}`
          );
          console.debug(`Aspect Ratio: ${aspectRatio}`);
          if (enableMultiScale) {
            console.debug(
              `Multi-Scale: ENABLED (testing ${scaleHashes.length} scales: ${scaleHashes.map((s) => `${(s.scale * 100).toFixed(0)}%`).join(', ')})`
            );
          }
          console.debug(`Concerts Checked (${hashAlgorithm}): ${concertsWithHashes.length}`);
          if (resolvedSecondaryHashAlgorithm) {
            console.debug(
              `Concerts Checked (${resolvedSecondaryHashAlgorithm}): ${concertsWithSecondaryHashes.length}`
            );
          }
          console.debug(
            `Threshold (${hashAlgorithm}): ${logThreshold(hashAlgorithm, similarityThreshold)}`
          );
          if (resolvedSecondaryHashAlgorithm) {
            console.debug(
              `Threshold (${resolvedSecondaryHashAlgorithm}): ${logThreshold(resolvedSecondaryHashAlgorithm, secondaryThreshold)}`
            );
          }
          console.debug('');
        }

        type MatchResult = {
          match: Concert | null;
          distance: number;
          scale: number;
          algorithm: HashAlgorithm;
        };

        const evaluateMatches = (
          algorithm: HashAlgorithm,
          threshold: number | undefined,
          scaleHashesForAlgorithm: Array<{
            hash: string;
            scale: number;
            region: typeof framedRegion;
          }>,
          concertsForAlgorithm: Concert[]
        ): MatchResult => {
          let best: MatchResult = { match: null, distance: Infinity, scale: 0.8, algorithm };

          if (import.meta.env.DEV || isTestMode) {
            console.debug(`Results (${algorithm}):`);
          }

          for (const concert of concertsForAlgorithm) {
            const hashes = getPhotoHashesForAlgorithm(concert, algorithm);

            let bestHashDistance = Infinity;
            let matchedHashIndex = -1;
            let matchedScale = 0.8;

            for (const { hash: scaleHash, scale } of scaleHashesForAlgorithm) {
              for (let i = 0; i < hashes.length; i++) {
                const hashDistance = hammingDistance(scaleHash, hashes[i]);
                if (hashDistance < bestHashDistance) {
                  bestHashDistance = hashDistance;
                  matchedHashIndex = i;
                  matchedScale = scale;
                }
              }
            }

            const distance = bestHashDistance;
            const similarity = similarityPercent(distance, algorithm);

            if (import.meta.env.DEV || isTestMode) {
              const isBest = distance < best.distance;
              const meetsThreshold = threshold !== undefined ? distance <= threshold : false;
              const status = meetsThreshold ? (isBest ? '✓' : '~') : '✗';
              const hashInfo =
                hashes.length > 1 ? ` (hash ${matchedHashIndex + 1}/${hashes.length})` : '';
              const scaleInfo = enableMultiScale
                ? ` @ ${(matchedScale * 100).toFixed(0)}% scale`
                : '';
              console.debug(
                `  ${status} ${concert.band}: distance=${distance}, similarity=${similarity.toFixed(1)}%${hashInfo}${scaleInfo}${isBest ? ' ← BEST MATCH' : ''}`
              );
            }

            if (distance < best.distance) {
              best = {
                match: concert,
                distance,
                scale: matchedScale,
                algorithm,
              };
            }
          }

          return best;
        };

        const primaryResult = evaluateMatches(
          hashAlgorithm,
          similarityThreshold,
          scaleHashes,
          concertsWithHashes
        );

        const secondaryHashes: Array<{ hash: string; scale: number; region: typeof framedRegion }> =
          [];
        if (resolvedSecondaryHashAlgorithm) {
          const sortedScales = Array.from(scaleImageDataMap.keys()).sort((a, b) => a - b);
          for (const scale of sortedScales) {
            const imageDataForScale = scaleImageDataMap.get(scale);
            const regionForScale = scaleRegionMap.get(scale) ?? framedRegion;
            if (!imageDataForScale) continue;
            const hashForScale =
              resolvedSecondaryHashAlgorithm === 'phash'
                ? computePHash(imageDataForScale)
                : computeDHash(imageDataForScale);
            secondaryHashes.push({ hash: hashForScale, scale, region: regionForScale });
          }
        }

        const secondaryResult =
          resolvedSecondaryHashAlgorithm &&
          secondaryHashes.length > 0 &&
          secondaryThreshold !== undefined
            ? evaluateMatches(
                resolvedSecondaryHashAlgorithm,
                secondaryThreshold,
                secondaryHashes,
                concertsWithSecondaryHashes
              )
            : null;

        const getThresholdForAlgorithm = (algorithm: HashAlgorithm): number => {
          if (algorithm === hashAlgorithm) {
            return similarityThreshold;
          }
          if (resolvedSecondaryHashAlgorithm && algorithm === resolvedSecondaryHashAlgorithm) {
            return secondaryThreshold ?? DEFAULT_THRESHOLDS[resolvedSecondaryHashAlgorithm];
          }
          return similarityThreshold;
        };

        const meetsThreshold = (result: MatchResult | null): boolean => {
          if (!result) return false;
          return result.distance <= getThresholdForAlgorithm(result.algorithm);
        };

        const matchedResult = meetsThreshold(primaryResult)
          ? primaryResult
          : meetsThreshold(secondaryResult)
            ? secondaryResult
            : null;

        const bestDisplayResult =
          matchedResult ??
          (secondaryResult && secondaryResult.distance < primaryResult.distance
            ? secondaryResult
            : primaryResult);

        // Update debug info if enabled
        if (enableDebugInfo || isTestMode) {
          const elapsedMs =
            matchStartTimeRef.current && matchedResult
              ? currentTime - (matchStartTimeRef.current ?? currentTime)
              : 0;
          const stabilityInfo =
            matchStartTimeRef.current && matchedResult && elapsedMs > 0
              ? {
                  concert: matchedResult.match as Concert,
                  elapsedMs,
                  remainingMs: Math.max(recognitionDelay - elapsedMs, 0),
                  requiredMs: recognitionDelay,
                  progress: Math.min(elapsedMs / recognitionDelay, 1),
                }
              : null;

          setDebugInfo({
            lastFrameHash: currentHash,
            bestMatch:
              bestDisplayResult.match && bestDisplayResult.match !== null
                ? {
                    concert: bestDisplayResult.match,
                    distance: bestDisplayResult.distance,
                    similarity: similarityPercent(
                      bestDisplayResult.distance,
                      bestDisplayResult.algorithm
                    ),
                    algorithm: bestDisplayResult.algorithm,
                    scale: bestDisplayResult.scale,
                  }
                : null,
            lastCheckTime: currentTime,
            concertCount: concertsWithHashes.length,
            frameCount: frameCountRef.current,
            checkInterval,
            aspectRatio,
            frameSize: { width: canvas.width, height: canvas.height },
            stability: stabilityInfo,
            similarityThreshold: getThresholdForAlgorithm(
              matchedResult ? matchedResult.algorithm : hashAlgorithm
            ),
            recognitionDelay,
            frameQuality: currentFrameQuality,
            telemetry: { ...telemetryRef.current },
            hashAlgorithm: matchedResult ? matchedResult.algorithm : hashAlgorithm,
          });
        }

        const activeResult = matchedResult;

        // Check if best match meets threshold
        if (activeResult && activeResult.match) {
          const activeThreshold = getThresholdForAlgorithm(activeResult.algorithm);
          const similarity = similarityPercent(activeResult.distance, activeResult.algorithm);

          if (import.meta.env.DEV || isTestMode) {
            console.debug('');
            console.debug(
              `Match Decision: POTENTIAL MATCH (${activeResult.match.band}) via ${activeResult.algorithm}`
            );
            console.debug(`  Distance: ${activeResult.distance} / ${activeThreshold} threshold`);
            console.debug(`  Similarity: ${similarity.toFixed(1)}%`);
            if (enableMultiScale && activeResult.scale !== 0.8) {
              console.debug(
                `  Best Scale: ${(activeResult.scale * 100).toFixed(0)}% (relaxed framing)`
              );
            }
          }

          if (lastMatchedConcertRef.current?.id === activeResult.match.id) {
            // Continue timing
            if (matchStartTimeRef.current) {
              const elapsed = Date.now() - matchStartTimeRef.current;

              if (import.meta.env.DEV || isTestMode) {
                console.debug(
                  `  Stability Timer: ${(elapsed / 1000).toFixed(1)}s / ${(recognitionDelay / 1000).toFixed(1)}s required`
                );
              }

              if (elapsed >= recognitionDelay) {
                // Stable match confirmed!
                setRecognizedConcert(activeResult.match);
                setIsRecognizing(false);
                telemetryRef.current.successfulRecognitions += 1;

                if (import.meta.env.DEV || isTestMode) {
                  console.log('');
                  console.log('🎵 RECOGNIZED!', activeResult.match.band);
                  console.log('━'.repeat(60));
                  console.log(`📊 Telemetry Summary:`);
                  console.log(`  Total Frames: ${telemetryRef.current.totalFrames}`);
                  console.log(
                    `  Quality Frames: ${telemetryRef.current.qualityFrames} (${((telemetryRef.current.qualityFrames / telemetryRef.current.totalFrames) * 100).toFixed(1)}%)`
                  );
                  console.log(
                    `  Blur Rejections: ${telemetryRef.current.blurRejections} (${((telemetryRef.current.blurRejections / telemetryRef.current.totalFrames) * 100).toFixed(1)}%)`
                  );
                  console.log(
                    `  Glare Rejections: ${telemetryRef.current.glareRejections} (${((telemetryRef.current.glareRejections / telemetryRef.current.totalFrames) * 100).toFixed(1)}%)`
                  );
                  console.log(
                    `  Successful Recognitions: ${telemetryRef.current.successfulRecognitions}`
                  );
                  console.log(`  Failed Attempts: ${telemetryRef.current.failedAttempts}`);
                  console.log(`\n  Failure Categories:`);
                  const categories = Object.entries(telemetryRef.current.failureByCategory);
                  categories.forEach(([category, count]) => {
                    if (count > 0) {
                      const pct = ((count / telemetryRef.current.totalFrames) * 100).toFixed(1);
                      console.log(`    ${category}: ${count} (${pct}%)`);
                    }
                  });
                  if (telemetryRef.current.failureHistory.length > 0) {
                    console.log(
                      `\n  Recent Failures (last ${telemetryRef.current.failureHistory.length}):`
                    );
                    telemetryRef.current.failureHistory.slice(-5).forEach((failure, idx) => {
                      const time = new Date(failure.timestamp).toLocaleTimeString();
                      console.log(
                        `    ${idx + 1}. [${time}] ${failure.category}: ${failure.reason}`
                      );
                    });
                  }
                }

                lastMatchedConcertRef.current = null;
                matchStartTimeRef.current = null;
              } else {
                setIsRecognizing(true);
              }
            }
          } else {
            // New match, start timing
            lastMatchedConcertRef.current = activeResult.match;
            matchStartTimeRef.current = Date.now();
            setIsRecognizing(true);

            if (import.meta.env.DEV || isTestMode) {
              console.debug('  Starting stability timer...');
              console.debug('━'.repeat(60));
            }
          }
        } else {
          // No match, reset
          if (import.meta.env.DEV || isTestMode) {
            if (bestDisplayResult.match) {
              const similarity = similarityPercent(
                bestDisplayResult.distance,
                bestDisplayResult.algorithm
              );
              const threshold = getThresholdForAlgorithm(bestDisplayResult.algorithm);
              const requiredSimilarity = similarityPercent(threshold, bestDisplayResult.algorithm);
              console.debug('');
              console.debug(
                `Match Decision: NO MATCH (best was ${bestDisplayResult.match.band} via ${bestDisplayResult.algorithm})`
              );
              console.debug(`  Distance: ${bestDisplayResult.distance} > ${threshold} threshold`);
              console.debug(
                `  Similarity: ${similarity.toFixed(1)}% < required ${requiredSimilarity.toFixed(1)}%`
              );
            } else {
              console.debug('');
              console.debug('Match Decision: NO CANDIDATES');
            }
            console.debug('━'.repeat(60));
          }

          // Record failure diagnostic
          if (bestDisplayResult.match) {
            const similarity = similarityPercent(
              bestDisplayResult.distance,
              bestDisplayResult.algorithm
            );
            const threshold = getThresholdForAlgorithm(bestDisplayResult.algorithm);
            const category: FailureCategory =
              bestDisplayResult.distance <= threshold + 10 ? 'collision' : 'no-match';
            recordFailure(
              telemetryRef.current,
              category,
              `Best match (${bestDisplayResult.algorithm}): ${bestDisplayResult.match.band}, distance ${bestDisplayResult.distance}, similarity ${similarity.toFixed(1)}%`,
              currentHash
            );
            if (isTestMode) {
              console.debug(`   Failure Category: ${category}`);
            }
          } else {
            recordFailure(
              telemetryRef.current,
              'no-match',
              'No concerts with hashes in database',
              currentHash
            );
            if (isTestMode) {
              console.debug(`   Failure Category: no-match (no candidates)`);
            }
          }

          if (lastMatchedConcertRef.current) {
            telemetryRef.current.failedAttempts += 1;
            lastMatchedConcertRef.current = null;
            matchStartTimeRef.current = null;
            setIsRecognizing(false);
          }
        }

        emitTelemetrySnapshot();
      } catch (error) {
        console.error('Photo recognition error:', error);
      }
    };

    // Start frame processing loop
    intervalRef.current = window.setInterval(checkFrame, checkInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
    // recognizedConcert is intentionally omitted from the dependency array because it is checked
    // inside the checkFrame closure. Including it would cause this effect to re-run and recreate
    // the interval when a concert is recognized, which is unnecessary since checkFrame already
    // stops processing when recognition completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stream,
    enabled,
    concerts,
    recognitionDelay,
    similarityThreshold,
    checkInterval,
    aspectRatio,
    sharpnessThreshold,
    glareThreshold,
    glarePercentageThreshold,
    hashAlgorithm,
    resolvedSecondaryHashAlgorithm,
    resolvedSecondaryThreshold,
    enableMultiScale,
    stableMultiScaleVariants,
    isEnabled,
    rectangleConfidenceThreshold,
    emitTelemetrySnapshot,
    restartKey,
  ]);

  return {
    recognizedConcert,
    isRecognizing,
    reset,
    debugInfo,
    frameQuality,
    activeGuidance,
    detectedRectangle,
    rectangleConfidence,
  };
}
