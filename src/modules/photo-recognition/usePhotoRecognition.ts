import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataService } from '../../services/data-service';
import type { Concert } from '../../types';
import { RectangleDetectionService } from '../photo-rectangle-detection';
import type { DetectedRectangle } from '../photo-rectangle-detection';
import { computePHash } from './algorithms/phash';
import { hammingDistance } from './algorithms/hamming';
import {
  createEmptyTelemetry,
  getPHashes,
  pickGuidance,
  recordFailure,
  similarityPercent,
} from './helpers';
import { calculateFramedRegion, calculateVisibleViewport, type ViewportRegion } from './framing';
import {
  calculateAdaptiveQualityThresholds,
  calculateAverageBrightness,
  computeLaplacianVariance,
  detectGlare,
  detectPoorLighting,
} from './algorithms/utils';
import { getPerspectiveCroppedImageData } from './algorithms/perspective';
import type {
  AspectRatio,
  FailureCategory,
  FrameQualityInfo,
  PhotoRecognitionHook,
  PhotoRecognitionOptions,
  RecognitionDebugInfo,
  RecognitionTelemetry,
  GuidanceType,
} from './types';

const DEFAULT_SIMILARITY_THRESHOLD = 12;
const DEFAULT_CHECK_INTERVAL = 180;
const DEFAULT_RECOGNITION_DELAY = 300;
const DEFAULT_DISPLAY_ASPECT_RATIO = 1;
const INSTANT_DISTANCE_THRESHOLD = 5;
const QUALITY_GATING_DISTANCE_THRESHOLD = 8;
const CONSECUTIVE_MATCHES_FOR_INSTANT_CONFIRM = 2;
const DEFAULT_SWITCH_RECOGNITION_DELAY_MULTIPLIER = 1.8;
const DEFAULT_SWITCH_DISTANCE_THRESHOLD = 7;
const DEFAULT_MATCH_MARGIN_THRESHOLD = 4;
const DEFAULT_SWITCH_MATCH_MARGIN_THRESHOLD = 5;
const SWITCH_INSTANT_DISTANCE_THRESHOLD = 3;
const CONSECUTIVE_SWITCH_MATCHES_FOR_CONFIRM = 3;

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
    switchMatchMarginThreshold = DEFAULT_SWITCH_MATCH_MARGIN_THRESHOLD,
    continuousRecognition = false,
    switchRecognitionDelayMultiplier = DEFAULT_SWITCH_RECOGNITION_DELAY_MULTIPLIER,
    switchDistanceThreshold = DEFAULT_SWITCH_DISTANCE_THRESHOLD,
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
  } = options;

  const [recognizedConcert, setRecognizedConcert] = useState<Concert | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [debugInfo, setDebugInfo] = useState<RecognitionDebugInfo | null>(null);
  const [frameQuality, setFrameQuality] = useState<FrameQualityInfo | null>(null);
  const [activeGuidance, setActiveGuidance] = useState<GuidanceType>('none');
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
  const switchCandidateConcertRef = useRef<Concert | null>(null);
  const switchCandidateStartTimeRef = useRef<number | null>(null);
  const switchConsecutiveMatchCountRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rectangleDetectorRef = useRef<RectangleDetectionService | null>(null);

  const reset = useCallback(() => {
    recognizedConcertRef.current = null;
    lastMatchedConcertRef.current = null;
    consecutiveMatchCountRef.current = 0;
    matchStartTimeRef.current = null;
    frameCountRef.current = 0;
    ambientBrightnessRef.current = null;
    ambientGlarePercentageRef.current = null;
    switchCandidateConcertRef.current = null;
    switchCandidateStartTimeRef.current = null;
    switchConsecutiveMatchCountRef.current = 0;
    telemetryRef.current = createEmptyTelemetry();

    setRecognizedConcert(null);
    setIsRecognizing(false);
    setDebugInfo(null);
    setFrameQuality(null);
    setActiveGuidance('none');
    setDetectedRectangle(null);
    setRectangleConfidence(0);
    setRestartKey((value) => value + 1);
  }, []);

  useEffect(() => {
    dataService
      .getConcerts()
      .then((loadedConcerts) => {
        setConcerts(loadedConcerts);
      })
      .catch((error) => {
        console.error('Failed to load concert data:', error);
        setConcerts([]);
      });
  }, []);

  const eligibleConcerts = useMemo(
    () => concerts.filter((concert) => getPHashes(concert).length > 0),
    [concerts]
  );

  /**
   * Pre-flattened list of all valid concert hashes, computed once when
   * eligible concerts change.  Moving getPHashes() (which includes a regex
   * validation pass) out of the per-frame hot path avoids redundant work on
   * every camera tick.
   */
  const concertHashList = useMemo(
    () =>
      eligibleConcerts.flatMap((concert) => getPHashes(concert).map((hash) => ({ hash, concert }))),
    [eligibleConcerts]
  );

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

    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      return;
    }

    rectangleDetectorRef.current = enableRectangleDetection
      ? new RectangleDetectionService()
      : null;

    const switchRecognitionDelay = Math.round(
      Math.max(recognitionDelay * switchRecognitionDelayMultiplier, recognitionDelay)
    );

    const clearSwitchTracking = () => {
      switchCandidateConcertRef.current = null;
      switchCandidateStartTimeRef.current = null;
      switchConsecutiveMatchCountRef.current = 0;
    };

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
        let perspectiveImageData: ImageData | null = null;

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
          const detectionResult = rectangleDetectorRef.current.detectRectangle(viewportImageData);
          setRectangleConfidence(detectionResult.confidence);

          if (detectionResult.detected && detectionResult.rectangle) {
            setDetectedRectangle(detectionResult.rectangle);
            const meetsConfidence = detectionResult.confidence >= rectangleConfidenceThreshold;
            if (meetsConfidence) {
              perspectiveImageData = getPerspectiveCroppedImageData(
                viewportImageData,
                detectionResult.rectangle
              );

              const pixelRectangle = {
                x: Math.round(detectionResult.rectangle.topLeft.x * visibleViewport.width),
                y: Math.round(detectionResult.rectangle.topLeft.y * visibleViewport.height),
                width: Math.round(detectionResult.rectangle.width * visibleViewport.width),
                height: Math.round(detectionResult.rectangle.height * visibleViewport.height),
              };

              if (pixelRectangle.width > 0 && pixelRectangle.height > 0) {
                framedRegion = offsetRegionToVideo(pixelRectangle);
              }
            }
          } else {
            setDetectedRectangle(null);
          }
        }

        const frameCaptureStartAt = performance.now();
        let imageData: ImageData;

        if (perspectiveImageData) {
          canvas.width = perspectiveImageData.width;
          canvas.height = perspectiveImageData.height;
          context.putImageData(perspectiveImageData, 0, 0);
          framedRegion = {
            x: framedRegion.x,
            y: framedRegion.y,
            width: perspectiveImageData.width,
            height: perspectiveImageData.height,
          };
          imageData = perspectiveImageData;
        } else {
          canvas.width = framedRegion.width;
          canvas.height = framedRegion.height;
          context.drawImage(
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

          imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        }

        frameCaptureMs = performance.now() - frameCaptureStartAt;

        const algorithmStartAt = performance.now();
        const currentHash = computePHash(imageData);
        let bestMatch: { concert: Concert; distance: number } | null = null;
        let secondBestMatch: { concert: Concert; distance: number } | null = null;

        for (const { hash, concert } of concertHashList) {
          const distance = hammingDistance(currentHash, hash);
          if (!bestMatch || distance < bestMatch.distance) {
            secondBestMatch = bestMatch;
            bestMatch = { concert, distance };
          } else if (
            !secondBestMatch ||
            (distance < secondBestMatch.distance && distance !== bestMatch.distance)
          ) {
            secondBestMatch = { concert, distance };
          }
        }
        algorithmMs = performance.now() - algorithmStartAt;

        const now = Date.now();
        const isSwitchMode = continuousRecognition && !!recognizedConcertRef.current;
        const activeThreshold = isSwitchMode
          ? Math.min(similarityThreshold, switchDistanceThreshold)
          : similarityThreshold;
        const bestMargin =
          bestMatch && secondBestMatch ? secondBestMatch.distance - bestMatch.distance : null;
        const requiredMargin = isSwitchMode ? switchMatchMarginThreshold : matchMarginThreshold;
        const hasSufficientMargin = bestMargin === null || bestMargin >= requiredMargin;
        const isWithinThreshold = !!bestMatch && bestMatch.distance <= activeThreshold;
        const isAmbiguousMatchCandidate = isWithinThreshold && !hasSufficientMargin;
        const activeMatch = isWithinThreshold && hasSufficientMargin ? bestMatch!.concert : null;

        const shouldRunQualityCheck =
          !bestMatch || !activeMatch || bestMatch.distance > QUALITY_GATING_DISTANCE_THRESHOLD;
        let quality: FrameQualityInfo | null = null;

        if (shouldRunQualityCheck) {
          const sharpness = computeLaplacianVariance(imageData);
          const isSharp = sharpness >= sharpnessThreshold;
          const averageBrightness = calculateAverageBrightness(imageData);

          ambientBrightnessRef.current =
            ambientBrightnessRef.current === null
              ? averageBrightness
              : ambientBrightnessRef.current * 0.85 + averageBrightness * 0.15;

          const adaptiveThresholds = calculateAdaptiveQualityThresholds(
            minBrightness,
            maxBrightness,
            glarePercentageThreshold,
            ambientBrightnessRef.current,
            ambientGlarePercentageRef.current
          );

          const glare = detectGlare(
            imageData,
            glareThreshold,
            adaptiveThresholds.glarePercentageThreshold
          );

          ambientGlarePercentageRef.current =
            ambientGlarePercentageRef.current === null
              ? glare.glarePercentage
              : ambientGlarePercentageRef.current * 0.85 + glare.glarePercentage * 0.15;

          const lighting = detectPoorLighting(
            imageData,
            adaptiveThresholds.minBrightness,
            adaptiveThresholds.maxBrightness
          );

          quality = {
            sharpness,
            isSharp,
            glarePercentage: glare.glarePercentage,
            hasGlare: glare.hasGlare,
            averageBrightness: lighting.averageBrightness,
            hasPoorLighting: lighting.hasPoorLighting,
            lightingType: lighting.type,
          };

          setFrameQuality(quality);
          setActiveGuidance(pickGuidance(quality));

          if (!quality.isSharp || quality.hasGlare || quality.hasPoorLighting) {
            if (!quality.isSharp) {
              telemetryRef.current.blurRejections += 1;
              recordFailure(
                telemetryRef.current,
                'motion-blur',
                'Sharpness below threshold',
                'N/A'
              );
            } else if (quality.hasGlare) {
              telemetryRef.current.glareRejections += 1;
              recordFailure(telemetryRef.current, 'glare', 'Frame has significant glare', 'N/A');
            } else {
              telemetryRef.current.lightingRejections += 1;
              recordFailure(telemetryRef.current, 'poor-quality', 'Frame has poor lighting', 'N/A');
            }

            lastMatchedConcertRef.current = null;
            consecutiveMatchCountRef.current = 0;
            matchStartTimeRef.current = null;
            clearSwitchTracking();
            setIsRecognizing(false);

            if (enableDebugInfo) {
              setDebugInfo({
                lastFrameHash: currentHash,
                bestMatch:
                  bestMatch !== null
                    ? {
                        concert: bestMatch.concert,
                        distance: bestMatch.distance,
                        similarity: similarityPercent(bestMatch.distance),
                        algorithm: 'phash',
                      }
                    : null,
                secondBestMatch:
                  secondBestMatch !== null
                    ? {
                        concert: secondBestMatch.concert,
                        distance: secondBestMatch.distance,
                        similarity: similarityPercent(secondBestMatch.distance),
                        algorithm: 'phash',
                      }
                    : null,
                bestMatchMargin: bestMargin,
                lastCheckTime: now,
                concertCount: eligibleConcerts.length,
                frameCount: frameCountRef.current,
                checkInterval,
                aspectRatio: chosenAspectRatio,
                frameSize: { width: framedRegion.width, height: framedRegion.height },
                stability: null,
                similarityThreshold,
                recognitionDelay,
                frameQuality: quality,
                telemetry: { ...telemetryRef.current },
                hashAlgorithm: 'phash',
              });
            }

            return;
          }

          telemetryRef.current.qualityFrames += 1;
        } else {
          setFrameQuality(null);
          setActiveGuidance('none');
        }

        const stability =
          activeMatch && isSwitchMode
            ? switchCandidateStartTimeRef.current &&
              switchCandidateConcertRef.current?.id === activeMatch.id
              ? (() => {
                  const elapsedMs = now - switchCandidateStartTimeRef.current;
                  return {
                    concert: activeMatch,
                    elapsedMs,
                    remainingMs: Math.max(switchRecognitionDelay - elapsedMs, 0),
                    requiredMs: switchRecognitionDelay,
                    progress:
                      switchRecognitionDelay > 0
                        ? Math.min(elapsedMs / switchRecognitionDelay, 1)
                        : 1,
                  };
                })()
              : null
            : activeMatch &&
                matchStartTimeRef.current &&
                lastMatchedConcertRef.current?.id === activeMatch.id
              ? (() => {
                  const elapsedMs = now - matchStartTimeRef.current;
                  return {
                    concert: activeMatch,
                    elapsedMs,
                    remainingMs: Math.max(recognitionDelay - elapsedMs, 0),
                    requiredMs: recognitionDelay,
                    progress: recognitionDelay > 0 ? Math.min(elapsedMs / recognitionDelay, 1) : 1,
                  };
                })()
              : null;

        if (enableDebugInfo) {
          setDebugInfo({
            lastFrameHash: currentHash,
            bestMatch:
              bestMatch !== null
                ? {
                    concert: bestMatch.concert,
                    distance: bestMatch.distance,
                    similarity: similarityPercent(bestMatch.distance),
                    algorithm: 'phash',
                  }
                : null,
            secondBestMatch:
              secondBestMatch !== null
                ? {
                    concert: secondBestMatch.concert,
                    distance: secondBestMatch.distance,
                    similarity: similarityPercent(secondBestMatch.distance),
                    algorithm: 'phash',
                  }
                : null,
            bestMatchMargin: bestMargin,
            lastCheckTime: now,
            concertCount: eligibleConcerts.length,
            frameCount: frameCountRef.current,
            checkInterval,
            aspectRatio: chosenAspectRatio,
            frameSize: { width: framedRegion.width, height: framedRegion.height },
            stability,
            similarityThreshold,
            recognitionDelay,
            frameQuality: quality,
            telemetry: { ...telemetryRef.current },
            hashAlgorithm: 'phash',
          });
        }

        if (activeMatch) {
          setActiveGuidance('none');

          if (isSwitchMode) {
            const currentlyRecognizedConcert = recognizedConcertRef.current;

            if (currentlyRecognizedConcert && activeMatch.id === currentlyRecognizedConcert.id) {
              clearSwitchTracking();
              setIsRecognizing(false);
              return;
            }

            const isStrongSwitchCandidate =
              !!bestMatch && bestMatch.distance <= switchDistanceThreshold;

            if (!isStrongSwitchCandidate) {
              clearSwitchTracking();
              setIsRecognizing(false);
              return;
            }

            const isSameSwitchCandidate = switchCandidateConcertRef.current?.id === activeMatch.id;
            switchConsecutiveMatchCountRef.current = isSameSwitchCandidate
              ? switchConsecutiveMatchCountRef.current + 1
              : 1;

            const isInstantSwitchDistance =
              !!bestMatch && bestMatch.distance <= SWITCH_INSTANT_DISTANCE_THRESHOLD;
            const hasConsecutiveSwitchConfidence =
              switchConsecutiveMatchCountRef.current >= CONSECUTIVE_SWITCH_MATCHES_FOR_CONFIRM;

            if (isSameSwitchCandidate) {
              if (
                (switchCandidateStartTimeRef.current &&
                  now - switchCandidateStartTimeRef.current >= switchRecognitionDelay) ||
                (isInstantSwitchDistance && hasConsecutiveSwitchConfidence)
              ) {
                recognizedConcertRef.current = activeMatch;
                confirmedMatch = true;
                setRecognizedConcert(activeMatch);
                setIsRecognizing(false);
                telemetryRef.current.successfulRecognitions += 1;
                clearSwitchTracking();
                return;
              }

              setIsRecognizing(true);
              return;
            }

            switchCandidateConcertRef.current = activeMatch;
            switchCandidateStartTimeRef.current = now;
            switchConsecutiveMatchCountRef.current = 1;
            setIsRecognizing(true);
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
            setRecognizedConcert(activeMatch);
            setIsRecognizing(false);
            telemetryRef.current.successfulRecognitions += 1;
            lastMatchedConcertRef.current = null;
            consecutiveMatchCountRef.current = 0;
            matchStartTimeRef.current = null;
            clearSwitchTracking();
            return;
          }

          if (isSameConcert) {
            if (matchStartTimeRef.current && now - matchStartTimeRef.current >= recognitionDelay) {
              recognizedConcertRef.current = activeMatch;
              confirmedMatch = true;
              setRecognizedConcert(activeMatch);
              setIsRecognizing(false);
              telemetryRef.current.successfulRecognitions += 1;
              lastMatchedConcertRef.current = null;
              consecutiveMatchCountRef.current = 0;
              matchStartTimeRef.current = null;
              clearSwitchTracking();
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
          const isAmbiguousCollision = !hasSufficientMargin;

          if (isAmbiguousMatchCandidate) {
            setActiveGuidance('ambiguous-match');
          } else {
            setActiveGuidance('none');
          }

          const category: FailureCategory =
            isAmbiguousCollision || bestMatch.distance <= similarityThreshold + 10
              ? 'collision'
              : 'no-match';
          recordFailure(
            telemetryRef.current,
            category,
            isAmbiguousCollision
              ? `Ambiguous match: ${bestMatch.concert.band} vs ${secondBestMatch?.concert.band} (margin ${bestMargin ?? 0})`
              : `Best match ${bestMatch.concert.band} (distance ${bestMatch.distance})`,
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
        clearSwitchTracking();
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
          });
          console.timeEnd(frameLabel);
        }
      }
    };

    // Adaptive scheduling: scan faster when tracking a candidate, slower when idle.
    // A fixed checkInterval (non-default) overrides this for test compatibility.
    const scheduleNext = () => {
      const isTracking =
        lastMatchedConcertRef.current !== null || switchCandidateConcertRef.current !== null;
      const delay =
        checkInterval !== DEFAULT_CHECK_INTERVAL ? checkInterval : isTracking ? 80 : 180;
      intervalRef.current = window.setTimeout(() => {
        checkFrame();
        scheduleNext();
      }, delay);
    };
    scheduleNext();

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = undefined;
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, [
    stream,
    enabled,
    eligibleConcerts,
    concertHashList,
    checkInterval,
    recognitionDelay,
    similarityThreshold,
    matchMarginThreshold,
    switchMatchMarginThreshold,
    continuousRecognition,
    switchRecognitionDelayMultiplier,
    switchDistanceThreshold,
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
