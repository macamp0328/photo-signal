import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataService } from '../../services/data-service';
import type { Concert } from '../../types';
import { useFeatureFlags } from '../secret-settings';
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
  computeLaplacianVariance,
  convertToGrayscale,
  detectGlare,
  detectPoorLighting,
} from './algorithms/utils';
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
const DEFAULT_CHECK_INTERVAL = 250;
const DEFAULT_RECOGNITION_DELAY = 1000;
const DEFAULT_DISPLAY_ASPECT_RATIO = 1;

export { calculateFramedRegion } from './framing';

export function usePhotoRecognition(
  stream: MediaStream | null,
  options: PhotoRecognitionOptions = {}
): PhotoRecognitionHook {
  const {
    recognitionDelay = DEFAULT_RECOGNITION_DELAY,
    enabled = true,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    checkInterval = DEFAULT_CHECK_INTERVAL,
    enableDebugInfo = false,
    aspectRatio = 'auto',
    sharpnessThreshold = 100,
    glareThreshold = 250,
    glarePercentageThreshold = 20,
    minBrightness = 50,
    maxBrightness = 220,
    enableRectangleDetection = false,
    rectangleConfidenceThreshold = 0.6,
    displayAspectRatio = DEFAULT_DISPLAY_ASPECT_RATIO,
  } = options;

  const { isEnabled } = useFeatureFlags();

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
  const matchStartTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rectangleDetectorRef = useRef<RectangleDetectionService | null>(null);

  const reset = useCallback(() => {
    recognizedConcertRef.current = null;
    lastMatchedConcertRef.current = null;
    matchStartTimeRef.current = null;
    frameCountRef.current = 0;
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

    const unsubscribe = dataService.subscribe(() => {
      dataService
        .getConcerts()
        .then((loadedConcerts) => {
          setConcerts(loadedConcerts);
        })
        .catch((error) => {
          console.error('Failed to reload concert data:', error);
          setConcerts([]);
        });
    });

    return unsubscribe;
  }, []);

  const eligibleConcerts = useMemo(
    () => concerts.filter((concert) => getPHashes(concert).length > 0),
    [concerts]
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

    const checkFrame = () => {
      if (recognizedConcertRef.current) {
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

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      if (isEnabled('grayscale-mode')) {
        convertToGrayscale(imageData);
      }

      const sharpness = computeLaplacianVariance(imageData);
      const isSharp = sharpness >= sharpnessThreshold;
      const glare = detectGlare(imageData, glareThreshold, glarePercentageThreshold);
      const lighting = detectPoorLighting(imageData, minBrightness, maxBrightness);

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
      setActiveGuidance(pickGuidance(quality));

      if (!quality.isSharp || quality.hasGlare || quality.hasPoorLighting) {
        if (!quality.isSharp) {
          telemetryRef.current.blurRejections += 1;
          recordFailure(telemetryRef.current, 'motion-blur', 'Sharpness below threshold', 'N/A');
        } else if (quality.hasGlare) {
          telemetryRef.current.glareRejections += 1;
          recordFailure(telemetryRef.current, 'glare', 'Frame has significant glare', 'N/A');
        } else {
          telemetryRef.current.lightingRejections += 1;
          recordFailure(telemetryRef.current, 'poor-quality', 'Frame has poor lighting', 'N/A');
        }

        lastMatchedConcertRef.current = null;
        matchStartTimeRef.current = null;
        setIsRecognizing(false);

        if (enableDebugInfo) {
          setDebugInfo({
            lastFrameHash: null,
            bestMatch: null,
            lastCheckTime: Date.now(),
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

      const currentHash = computePHash(imageData);
      let bestMatch: { concert: Concert; distance: number } | null = null;

      for (const concert of eligibleConcerts) {
        const hashes = getPHashes(concert);
        for (const hash of hashes) {
          const distance = hammingDistance(currentHash, hash);
          if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = { concert, distance };
          }
        }
      }

      const now = Date.now();
      const isWithinThreshold = !!bestMatch && bestMatch.distance <= similarityThreshold;
      const activeMatch = isWithinThreshold ? bestMatch!.concert : null;

      const stability =
        activeMatch &&
        matchStartTimeRef.current &&
        lastMatchedConcertRef.current?.id === activeMatch.id
          ? (() => {
              const elapsedMs = now - matchStartTimeRef.current;
              return {
                concert: activeMatch,
                elapsedMs,
                remainingMs: Math.max(recognitionDelay - elapsedMs, 0),
                requiredMs: recognitionDelay,
                progress: Math.min(elapsedMs / recognitionDelay, 1),
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
        if (lastMatchedConcertRef.current?.id === activeMatch.id) {
          if (matchStartTimeRef.current && now - matchStartTimeRef.current >= recognitionDelay) {
            recognizedConcertRef.current = activeMatch;
            setRecognizedConcert(activeMatch);
            setIsRecognizing(false);
            telemetryRef.current.successfulRecognitions += 1;
            lastMatchedConcertRef.current = null;
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
        const category: FailureCategory =
          bestMatch.distance <= similarityThreshold + 10 ? 'collision' : 'no-match';
        recordFailure(
          telemetryRef.current,
          category,
          `Best match ${bestMatch.concert.band} (distance ${bestMatch.distance})`,
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
      matchStartTimeRef.current = null;
      setIsRecognizing(false);
    };

    intervalRef.current = window.setInterval(checkFrame, checkInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
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
    checkInterval,
    recognitionDelay,
    similarityThreshold,
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
    isEnabled,
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
