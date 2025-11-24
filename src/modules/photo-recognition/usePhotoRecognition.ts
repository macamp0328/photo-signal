import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { dataService } from '../../services/data-service';
import { useFeatureFlags } from '../secret-settings';
import { RectangleDetectionService } from '../photo-rectangle-detection';
import type { DetectedRectangle } from '../photo-rectangle-detection';
import type { Concert, ORBFeaturePayload } from '../../types';
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
import { extractORBFeatures, matchORBFeatures } from './algorithms/orb';
import type { ORBFeatures, ORBMatchResult, ORBConfig } from './algorithms/orb';
import { ParallelPhotoRecognizer } from './algorithms/parallel-recognizer';
import {
  convertToGrayscale,
  computeLaplacianVariance,
  detectGlare,
  detectPoorLighting,
} from './algorithms/utils';

type PerceptualHashAlgorithm = Extract<HashAlgorithm, 'dhash' | 'phash'>;

const HASH_LENGTHS: Record<PerceptualHashAlgorithm, number> = {
  dhash: 32,
  phash: 16,
};

const DEFAULT_THRESHOLDS: Record<PerceptualHashAlgorithm, number> = {
  dhash: 24,
  phash: 12,
};

const DEFAULT_ORB_HOOK_CONFIG: ORBConfig = {
  maxFeatures: 1000, // Increased for reference images (computed once, cached)
  scaleFactor: 1.5, // Better scale invariance for print-to-camera
  nLevels: 8,
  edgeThreshold: 15, // Reduced to allow features at higher octaves
  fastThreshold: 12, // Reduced to detect more corners
  minMatchCount: 20,
  matchRatioThreshold: 0.75, // Slightly more lenient for print distortions
};

const ORB_FRAME_PLACEHOLDER = 'ORB';

const loadImageData = (src: string): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image API is not available in this environment'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (width === 0 || height === 0) {
        reject(new Error(`Image ${src} has invalid dimensions`));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get 2D context for ORB reference image'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, width, height));
    };

    img.onerror = () => {
      reject(new Error(`Failed to load ORB reference image: ${src}`));
    };

    img.src = src;
  });
};

const decodeBase64ToUint8Array = (value: string): Uint8Array | null => {
  try {
    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    const bufferCtor = (
      globalThis as typeof globalThis & {
        Buffer?: {
          from: (input: string, encoding: string) => Uint8Array | number[];
        };
      }
    ).Buffer;

    if (bufferCtor) {
      const buffer = bufferCtor.from(value, 'base64');
      return buffer instanceof Uint8Array ? buffer : Uint8Array.from(buffer);
    }
  } catch (error) {
    console.error('[Photo Recognition][ORB] Failed to decode descriptor payload', error);
  }

  return null;
};

const deserializeORBFeatures = (payload?: ORBFeaturePayload): ORBFeatures | null => {
  if (!payload || !Array.isArray(payload.keypoints) || !Array.isArray(payload.descriptors)) {
    if (payload && payload.keypoints?.length === 0 && !payload.descriptors) {
      return { keypoints: [], descriptors: [] };
    }
    return null;
  }

  const keypoints = payload.keypoints.map(([x, y, angle, response, octave, size]) => ({
    x,
    y,
    angle,
    response,
    octave,
    size,
  }));

  const descriptors: Uint8Array[] = [];
  for (const descriptor of payload.descriptors) {
    const decoded = decodeBase64ToUint8Array(descriptor);
    if (!decoded) {
      return null;
    }
    descriptors.push(decoded);
  }

  if (keypoints.length !== descriptors.length) {
    const usableLength = Math.min(keypoints.length, descriptors.length);
    return {
      keypoints: keypoints.slice(0, usableLength),
      descriptors: descriptors.slice(0, usableLength),
    };
  }

  return { keypoints, descriptors };
};

const maxDistanceForAlgorithm = (algorithm: PerceptualHashAlgorithm): number =>
  HASH_LENGTHS[algorithm] * 4;

const similarityPercent = (distance: number, algorithm: PerceptualHashAlgorithm): number => {
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

const isValidForAlgorithm = (hashes: string[], algorithm: PerceptualHashAlgorithm): boolean => {
  if (hashes.length === 0) {
    return false;
  }
  const expectedLength = HASH_LENGTHS[algorithm];
  return hashes.every((value) => value.length === expectedLength);
};

const getPhotoHashesForAlgorithm = (
  concert: Concert,
  algorithm: PerceptualHashAlgorithm
): string[] => {
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

const hasPhotoHashesForAlgorithm = (
  concert: Concert,
  algorithm: PerceptualHashAlgorithm
): boolean => getPhotoHashesForAlgorithm(concert, algorithm).length > 0;

const isPerceptualAlgorithm = (algorithm: HashAlgorithm): algorithm is PerceptualHashAlgorithm =>
  algorithm === 'dhash' || algorithm === 'phash';

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

interface ViewportRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_DISPLAY_ASPECT_RATIO = 1;

const calculateVisibleViewport = (
  videoWidth: number,
  videoHeight: number,
  displayAspectRatio: number = DEFAULT_DISPLAY_ASPECT_RATIO
): ViewportRegion => {
  const safeRatio = displayAspectRatio > 0 ? displayAspectRatio : videoWidth / videoHeight;
  const videoRatio = videoWidth / videoHeight;

  if (!Number.isFinite(videoRatio) || !Number.isFinite(safeRatio)) {
    return { x: 0, y: 0, width: videoWidth, height: videoHeight };
  }

  if (Math.abs(videoRatio - safeRatio) < 0.001) {
    return {
      x: 0,
      y: 0,
      width: videoWidth,
      height: videoHeight,
    };
  }

  if (videoRatio > safeRatio) {
    const height = videoHeight;
    const width = Math.round(height * safeRatio);
    const x = Math.round((videoWidth - width) / 2);
    return { x, y: 0, width, height };
  }

  const width = videoWidth;
  const height = Math.round(width / safeRatio);
  const y = Math.round((videoHeight - height) / 2);
  return { x: 0, y, width, height };
};

/**
 * Calculate the framed region coordinates based on aspect ratio
 * @param videoWidth - Width of the video in pixels
 * @param videoHeight - Height of the video in pixels
 * @param aspectRatio - Target aspect ratio ('3:2' or '2:3'). 'auto' must be resolved before calling.
 * @param scale - Scale factor for the frame size (default 0.8 = 80% of viewport)
 * @returns Coordinates for cropping {x, y, width, height}
 */
export function calculateFramedRegion(
  videoWidth: number,
  videoHeight: number,
  aspectRatio: AspectRatio,
  scale: number = 0.8
): { x: number; y: number; width: number; height: number } {
  const targetRatio = aspectRatio === '3:2' ? 3 / 2 : aspectRatio === '2:3' ? 2 / 3 : 1;
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
    aspectRatio = 'auto',
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
    orbConfig,
    displayAspectRatio = DEFAULT_DISPLAY_ASPECT_RATIO,
    enableParallelRecognition = false,
    parallelRecognitionConfig,
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

  const resolvedOrbConfig = useMemo(
    () => ({ ...DEFAULT_ORB_HOOK_CONFIG, ...(orbConfig ?? {}) }),
    [orbConfig]
  );
  const orbMinMatchThreshold =
    resolvedOrbConfig.minMatchCount ?? DEFAULT_ORB_HOOK_CONFIG.minMatchCount ?? 15;

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
  const orbReferenceFeaturesRef = useRef<Map<number, ORBFeatures>>(new Map());
  const orbReferencesReadyRef = useRef(false);
  const parallelRecognizerRef = useRef<ParallelPhotoRecognizer | null>(null); // Parallel recognizer instance
  const intervalRef = useRef<number | undefined>(undefined);
  const lastMatchedConcertRef = useRef<Concert | null>(null);
  const matchStartTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const telemetryDispatchRef = useRef<number>(0);
  const processingFrameCountRef = useRef<number>(0); // Frame counter for frame skipping optimization

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

  // Preload ORB reference features when ORB mode is enabled
  useEffect(() => {
    if (hashAlgorithm !== 'orb') {
      orbReferenceFeaturesRef.current.clear();
      orbReferencesReadyRef.current = false;
      return;
    }

    if (concerts.length === 0) {
      orbReferenceFeaturesRef.current.clear();
      orbReferencesReadyRef.current = false;
      return;
    }

    let cancelled = false;
    orbReferencesReadyRef.current = false;
    const referenceMap = orbReferenceFeaturesRef.current;
    referenceMap.clear();

    const prepareReferences = async () => {
      const pendingExtraction: Concert[] = [];
      let hydratedCount = 0;
      let invalidSerializedCount = 0;

      for (const concert of concerts) {
        if (concert.orbFeatures) {
          const hydrated = deserializeORBFeatures(concert.orbFeatures);
          if (hydrated) {
            referenceMap.set(concert.id, hydrated);
            hydratedCount += 1;
            continue;
          }

          invalidSerializedCount += 1;
          if (import.meta.env.DEV || isEnabled('test-mode')) {
            console.warn(
              `[Photo Recognition][ORB] Serialized payload for ${concert.band} (${concert.id}) is invalid, falling back to image extraction`
            );
          }
        }

        pendingExtraction.push(concert);
      }

      let generatedCount = 0;
      for (const concert of pendingExtraction) {
        if (!concert.imageFile) {
          if (import.meta.env.DEV || isEnabled('test-mode')) {
            console.warn(
              `[Photo Recognition][ORB] Missing imageFile for concert ${concert.band} (${concert.id})`
            );
          }
          continue;
        }

        try {
          const imageData = await loadImageData(concert.imageFile);
          if (cancelled) {
            return;
          }

          const features = extractORBFeatures(imageData, resolvedOrbConfig);
          referenceMap.set(concert.id, features);
          generatedCount += 1;
        } catch (error) {
          if (import.meta.env.DEV || isEnabled('test-mode')) {
            console.error(
              `[Photo Recognition][ORB] Failed to prep features for ${concert.band} (${concert.imageFile})`,
              error
            );
          }
        }
      }

      if (!cancelled) {
        orbReferencesReadyRef.current = referenceMap.size > 0;
        if (import.meta.env.DEV || isEnabled('test-mode')) {
          console.log(
            `[Photo Recognition][ORB] Reference warmup complete (${referenceMap.size} concerts cached | hydrated=${hydratedCount} | generated=${generatedCount} | invalidSerialized=${invalidSerializedCount})`
          );
        }
      }
    };

    prepareReferences();

    return () => {
      cancelled = true;
    };
  }, [concerts, hashAlgorithm, resolvedOrbConfig, isEnabled]);

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
    processingFrameCountRef.current = 0;
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
      const primaryIsPerceptual = isPerceptualAlgorithm(hashAlgorithm);
      const concertsWithHashes = primaryIsPerceptual
        ? concerts.filter((concert) => hasPhotoHashesForAlgorithm(concert, hashAlgorithm))
        : [];
      if (primaryIsPerceptual) {
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
      } else {
        console.log(
          `  ORB min matches: ${orbMinMatchThreshold} (ratio threshold ${(resolvedOrbConfig.matchRatioThreshold ?? DEFAULT_ORB_HOOK_CONFIG.matchRatioThreshold ?? 0.7) * 100}%)`
        );
        console.log(
          `  ORB reference cache: ${orbReferenceFeaturesRef.current.size > 0 ? 'WARM' : 'WARMING UP'}`
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
      if (primaryIsPerceptual && concertsWithHashes.length > 0) {
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

    // Create canvas for frame extraction (reusable across all frames)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      console.error('Failed to get canvas 2D context');
      return;
    }
    canvasRef.current = canvas;

    // Initialize rectangle detector if enabled
    if (enableRectangleDetection && !rectangleDetectorRef.current) {
      rectangleDetectorRef.current = new RectangleDetectionService({
        minArea: 0.05, // Detect smaller photos
        maxArea: 0.9,
        minAspectRatio: 0.4, // More lenient for portrait
        maxAspectRatio: 3.0, // More lenient for landscape
        cannyHighThreshold: 100, // Lower threshold for better edge detection
        minConfidence: 0.3, // Very lenient to catch more candidates
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

      // Frame skipping optimization: Process every 3rd frame
      if (processingFrameCountRef.current % 3 !== 0) {
        processingFrameCountRef.current += 1;
        return; // Skip 2 out of 3 frames
      }
      processingFrameCountRef.current += 1;

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

        // Reuse canvas and context (already created during initialization)
        // Clear and reuse the existing canvas for this frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Determine base aspect ratio before detection
        const normalizedAspectRatio: AspectRatio =
          aspectRatio === '3:2' ||
          aspectRatio === '2:3' ||
          aspectRatio === '1:1' ||
          aspectRatio === 'auto'
            ? aspectRatio
            : 'auto';

        let chosenAspectRatio: AspectRatio =
          normalizedAspectRatio === 'auto' ? '1:1' : normalizedAspectRatio;

        const visibleViewport = calculateVisibleViewport(
          video.videoWidth,
          video.videoHeight,
          displayAspectRatio
        );

        const offsetRegionToVideo = (region: ViewportRegion): ViewportRegion => ({
          x: Math.round(visibleViewport.x + region.x),
          y: Math.round(visibleViewport.y + region.y),
          width: Math.round(region.width),
          height: Math.round(region.height),
        });

        // Optional: Detect rectangle in frame (when enabled)
        let finalFramedRegion = offsetRegionToVideo(
          calculateFramedRegion(visibleViewport.width, visibleViewport.height, chosenAspectRatio)
        );

        if (enableRectangleDetection && rectangleDetectorRef.current) {
          // First, capture the full frame for rectangle detection
          canvas.width = visibleViewport.width;
          canvas.height = visibleViewport.height;
          ctx.drawImage(
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
            // Use detected rectangle aspect to influence subsequent scaling/metrics
            chosenAspectRatio = rect.width >= rect.height ? '3:2' : '2:3';
            // Convert normalized coordinates to pixel coordinates
            finalFramedRegion = {
              x: Math.round(visibleViewport.x + rect.topLeft.x * visibleViewport.width),
              y: Math.round(visibleViewport.y + rect.topLeft.y * visibleViewport.height),
              width: Math.round(rect.width * visibleViewport.width),
              height: Math.round(rect.height * visibleViewport.height),
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

        // Parallel recognition mode: Run all three algorithms simultaneously
        if (enableParallelRecognition) {
          // Initialize parallel recognizer if not already done
          if (!parallelRecognizerRef.current) {
            parallelRecognizerRef.current = new ParallelPhotoRecognizer({
              dhashThreshold: similarityThreshold,
              phashThreshold: resolvedSecondaryThreshold ?? DEFAULT_THRESHOLDS.phash,
              orbConfig: resolvedOrbConfig,
              ...parallelRecognitionConfig,
            });
          }

          // Ensure ORB features are ready
          if (!orbReferencesReadyRef.current) {
            if (import.meta.env.DEV || isTestMode) {
              console.debug('[Photo Recognition][Parallel] ORB features not ready yet, skipping');
            }
            return;
          }

          const startParallelTime = performance.now();
          parallelRecognizerRef.current
            .recognize(imageData, concerts, orbReferenceFeaturesRef.current)
            .then((result) => {
              const parallelTimeMs = performance.now() - startParallelTime;

              if (import.meta.env.DEV || isTestMode) {
                console.debug(`\n${'='.repeat(60)}`);
                console.debug(
                  `[Parallel Recognition] FRAME ${frameCountRef.current} @ ${timestamp}`
                );
                console.debug(`Total execution time: ${parallelTimeMs.toFixed(2)}ms`);
                console.debug(`\nIndividual algorithms:`);
                result.algorithmResults.forEach((algResult) => {
                  console.debug(
                    `  ${algResult.algorithm.toUpperCase()}: ${algResult.executionTimeMs.toFixed(2)}ms, ` +
                      `similarity=${(algResult.similarityScore * 100).toFixed(1)}%, ` +
                      `confidence=${(algResult.confidence * 100).toFixed(1)}%` +
                      (algResult.matchedConcert
                        ? ` → ${algResult.matchedConcert.band}`
                        : ' → NO MATCH')
                  );
                });
                console.debug(`\nVoting details:`);
                console.debug(
                  `  dhash vote: ${(result.votingDetails.dhashVote * 100).toFixed(1)}%`
                );
                console.debug(
                  `  phash vote: ${(result.votingDetails.phashVote * 100).toFixed(1)}%`
                );
                console.debug(`  orb vote: ${(result.votingDetails.orbVote * 100).toFixed(1)}%`);
                console.debug(
                  `  Combined score: ${(result.votingDetails.combinedScore * 100).toFixed(1)}%`
                );
                console.debug(
                  `\nFinal decision: ${result.matchedConcert ? result.matchedConcert.band : 'NO MATCH'}`
                );
                console.debug(
                  `Overall confidence: ${(result.overallConfidence * 100).toFixed(1)}%`
                );
                console.debug('='.repeat(60));
              }

              // Update debug info if enabled
              if (enableDebugInfo || isTestMode) {
                const bestAlgResult = result.algorithmResults.reduce((best, curr) =>
                  curr.confidence > best.confidence ? curr : best
                );
                const stabilityInfo =
                  matchStartTimeRef.current && result.matchedConcert
                    ? (() => {
                        const elapsedMs = currentTime - (matchStartTimeRef.current ?? currentTime);
                        return {
                          concert: result.matchedConcert,
                          elapsedMs,
                          remainingMs: Math.max(recognitionDelay - elapsedMs, 0),
                          requiredMs: recognitionDelay,
                          progress: Math.min(elapsedMs / recognitionDelay, 1),
                        };
                      })()
                    : null;

                setDebugInfo({
                  lastFrameHash: 'PARALLEL',
                  bestMatch: result.matchedConcert
                    ? {
                        concert: result.matchedConcert,
                        distance: 0,
                        similarity: result.overallConfidence * 100,
                        algorithm: bestAlgResult.algorithm as HashAlgorithm,
                        scale: 1,
                      }
                    : null,
                  lastCheckTime: currentTime,
                  concertCount: concerts.length,
                  frameCount: frameCountRef.current,
                  checkInterval,
                  aspectRatio: chosenAspectRatio,
                  frameSize: { width: canvas.width, height: canvas.height },
                  stability: stabilityInfo,
                  similarityThreshold: 0,
                  recognitionDelay,
                  frameQuality: currentFrameQuality,
                  telemetry: { ...telemetryRef.current },
                  hashAlgorithm: 'dhash', // Primary algorithm
                });
              }

              // Handle match stability
              if (result.matchedConcert) {
                if (lastMatchedConcertRef.current?.id === result.matchedConcert.id) {
                  if (matchStartTimeRef.current) {
                    const elapsed = Date.now() - matchStartTimeRef.current;
                    if (elapsed >= recognitionDelay) {
                      setRecognizedConcert(result.matchedConcert);
                      setIsRecognizing(false);
                      telemetryRef.current.successfulRecognitions += 1;
                      lastMatchedConcertRef.current = null;
                      matchStartTimeRef.current = null;
                      if (import.meta.env.DEV || isTestMode) {
                        console.log('🎵 PARALLEL RECOGNITION SUCCESS!', result.matchedConcert.band);
                      }
                    } else {
                      setIsRecognizing(true);
                    }
                  }
                } else {
                  lastMatchedConcertRef.current = result.matchedConcert;
                  matchStartTimeRef.current = Date.now();
                  setIsRecognizing(true);
                }
              } else {
                if (lastMatchedConcertRef.current) {
                  telemetryRef.current.failedAttempts += 1;
                  lastMatchedConcertRef.current = null;
                  matchStartTimeRef.current = null;
                  setIsRecognizing(false);
                }
              }

              emitTelemetrySnapshot();
            })
            .catch((error) => {
              console.error('[Parallel Recognition] Error:', error);
              recordFailure(
                telemetryRef.current,
                'unknown',
                `Parallel recognition error: ${(error as Error).message}`,
                'PARALLEL'
              );
              emitTelemetrySnapshot();
            });

          return; // Skip single-algorithm logic when parallel mode is enabled
        }

        if (hashAlgorithm === 'orb') {
          if (!orbReferencesReadyRef.current) {
            if (import.meta.env.DEV || isTestMode) {
              console.debug('[Photo Recognition][ORB] Reference features not ready yet, skipping');
            }
            return;
          }

          const referenceMap = orbReferenceFeaturesRef.current;
          if (referenceMap.size === 0) {
            if (import.meta.env.DEV || isTestMode) {
              console.warn('[Photo Recognition][ORB] Reference cache is empty');
            }
            recordFailure(
              telemetryRef.current,
              'no-match',
              'ORB reference cache is empty',
              ORB_FRAME_PLACEHOLDER
            );
            emitTelemetrySnapshot();
            return;
          }

          let frameFeatures: ORBFeatures | null = null;
          try {
            frameFeatures = extractORBFeatures(imageData, resolvedOrbConfig);
          } catch (error) {
            console.error('[Photo Recognition][ORB] Failed to extract features from frame', error);
            recordFailure(
              telemetryRef.current,
              'poor-quality',
              `ORB extraction failed: ${(error as Error)?.message ?? 'Unknown error'}`,
              ORB_FRAME_PLACEHOLDER
            );
            emitTelemetrySnapshot();
            return;
          }

          let bestOrbResult: { concert: Concert; result: ORBMatchResult } | null = null;
          for (const concert of concerts) {
            const refFeatures = referenceMap.get(concert.id);
            if (!refFeatures) {
              continue;
            }

            const result = matchORBFeatures(frameFeatures, refFeatures, resolvedOrbConfig);
            if (!bestOrbResult || result.confidence > bestOrbResult.result.confidence) {
              bestOrbResult = { concert, result };
            }
          }

          if (!bestOrbResult) {
            recordFailure(
              telemetryRef.current,
              'no-match',
              'No ORB matches available for current frame',
              ORB_FRAME_PLACEHOLDER
            );
            emitTelemetrySnapshot();
            return;
          }

          const { concert: bestConcert, result: orbResult } = bestOrbResult;
          const orbMatch = orbResult.isMatch;
          const confidencePct = (orbResult.confidence * 100).toFixed(1);
          const ratioPct = (orbResult.matchRatio * 100).toFixed(1);

          if (import.meta.env.DEV || isTestMode) {
            console.debug(
              `\n[Photo Recognition][ORB] FRAME ${frameCountRef.current} @ ${timestamp}`
            );
            console.debug(
              `  Best match: ${bestConcert.band} | matches=${orbResult.matchCount} | ratio=${ratioPct}% | confidence=${confidencePct}%`
            );
            console.debug(`  Threshold: ${orbMinMatchThreshold} matches`);
            console.debug(`  Decision: ${orbMatch ? 'POTENTIAL MATCH' : 'NO MATCH'}`);
          }

          const matchedConcert = orbMatch ? bestConcert : null;
          const stabilityInfo =
            matchStartTimeRef.current &&
            matchedConcert &&
            lastMatchedConcertRef.current?.id === matchedConcert.id
              ? (() => {
                  const elapsedMs = currentTime - (matchStartTimeRef.current ?? currentTime);
                  return {
                    concert: matchedConcert,
                    elapsedMs,
                    remainingMs: Math.max(recognitionDelay - elapsedMs, 0),
                    requiredMs: recognitionDelay,
                    progress: Math.min(elapsedMs / recognitionDelay, 1),
                  };
                })()
              : null;

          if (enableDebugInfo || isTestMode) {
            setDebugInfo({
              lastFrameHash: ORB_FRAME_PLACEHOLDER,
              bestMatch: {
                concert: bestConcert,
                distance: orbResult.matchCount,
                similarity: orbResult.confidence * 100,
                algorithm: 'orb',
                scale: 1,
              },
              lastCheckTime: currentTime,
              concertCount: referenceMap.size,
              frameCount: frameCountRef.current,
              checkInterval,
              aspectRatio: chosenAspectRatio,
              frameSize: { width: canvas.width, height: canvas.height },
              stability: stabilityInfo,
              similarityThreshold: orbMinMatchThreshold,
              recognitionDelay,
              frameQuality: currentFrameQuality,
              telemetry: { ...telemetryRef.current },
              hashAlgorithm: 'orb',
            });
          }

          if (matchedConcert) {
            if (lastMatchedConcertRef.current?.id === matchedConcert.id) {
              if (matchStartTimeRef.current) {
                const elapsed = Date.now() - matchStartTimeRef.current;
                if (import.meta.env.DEV || isTestMode) {
                  console.debug(
                    `  Stability Timer: ${(elapsed / 1000).toFixed(1)}s / ${(recognitionDelay / 1000).toFixed(1)}s required`
                  );
                }

                if (elapsed >= recognitionDelay) {
                  setRecognizedConcert(matchedConcert);
                  setIsRecognizing(false);
                  telemetryRef.current.successfulRecognitions += 1;
                  lastMatchedConcertRef.current = null;
                  matchStartTimeRef.current = null;
                } else {
                  setIsRecognizing(true);
                }
              }
            } else {
              lastMatchedConcertRef.current = matchedConcert;
              matchStartTimeRef.current = Date.now();
              setIsRecognizing(true);
              if (import.meta.env.DEV || isTestMode) {
                console.debug('  Starting ORB stability timer...');
              }
            }
          } else {
            const failureReason = `Best ORB match ${bestConcert.band} with ${orbResult.matchCount} matches (${confidencePct}% confidence)`;
            recordFailure(telemetryRef.current, 'no-match', failureReason, ORB_FRAME_PLACEHOLDER);
            if (lastMatchedConcertRef.current) {
              telemetryRef.current.failedAttempts += 1;
              lastMatchedConcertRef.current = null;
              matchStartTimeRef.current = null;
              setIsRecognizing(false);
            }
          }

          emitTelemetrySnapshot();
          return;
        }

        if (!isPerceptualAlgorithm(hashAlgorithm)) {
          return;
        }

        const perceptualAlgorithm = hashAlgorithm;

        // Cache primary scale image data/region for potential secondary hashing
        scaleImageDataMap.set(0.8, imageData);
        scaleRegionMap.set(0.8, framedRegion);

        // Compute hash of current frame using selected algorithm
        const currentHash =
          perceptualAlgorithm === 'phash' ? computePHash(imageData) : computeDHash(imageData);

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
          const scaledRegion = offsetRegionToVideo(
            calculateFramedRegion(
              visibleViewport.width,
              visibleViewport.height,
              chosenAspectRatio,
              scale
            )
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
              perceptualAlgorithm === 'phash'
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
          hasPhotoHashesForAlgorithm(concert, perceptualAlgorithm)
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

        const logThreshold = (
          algorithm: PerceptualHashAlgorithm,
          threshold: number | undefined
        ) => {
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
          console.debug(
            `Aspect Ratio: ${chosenAspectRatio}${normalizedAspectRatio === 'auto' ? ' (auto)' : ''}`
          );
          if (enableMultiScale) {
            console.debug(
              `Multi-Scale: ENABLED (testing ${scaleHashes.length} scales: ${scaleHashes.map((s) => `${(s.scale * 100).toFixed(0)}%`).join(', ')})`
            );
          }
          console.debug(`Concerts Checked (${perceptualAlgorithm}): ${concertsWithHashes.length}`);
          if (resolvedSecondaryHashAlgorithm) {
            console.debug(
              `Concerts Checked (${resolvedSecondaryHashAlgorithm}): ${concertsWithSecondaryHashes.length}`
            );
          }
          console.debug(
            `Threshold (${perceptualAlgorithm}): ${logThreshold(perceptualAlgorithm, similarityThreshold)}`
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
          algorithm: PerceptualHashAlgorithm;
        };

        const evaluateMatches = (
          algorithm: PerceptualHashAlgorithm,
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
          perceptualAlgorithm,
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

        const getThresholdForAlgorithm = (algorithm: PerceptualHashAlgorithm): number => {
          if (algorithm === perceptualAlgorithm) {
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
            aspectRatio: chosenAspectRatio,
            frameSize: { width: canvas.width, height: canvas.height },
            stability: stabilityInfo,
            similarityThreshold: getThresholdForAlgorithm(
              matchedResult ? matchedResult.algorithm : perceptualAlgorithm
            ),
            recognitionDelay,
            frameQuality: currentFrameQuality,
            telemetry: { ...telemetryRef.current },
            hashAlgorithm: matchedResult ? matchedResult.algorithm : perceptualAlgorithm,
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
