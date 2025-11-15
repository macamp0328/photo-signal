import { useEffect, useRef, useState, useCallback } from 'react';
import { dataService } from '../../services/data-service';
import { useFeatureFlags } from '../secret-settings';
import type { Concert } from '../../types';
import type {
  PhotoRecognitionHook,
  PhotoRecognitionOptions,
  RecognitionDebugInfo,
  AspectRatio,
} from './types';
import { computeDHash } from './algorithms/dhash';
import { hammingDistance } from './algorithms/hamming';
import { convertToGrayscale } from './algorithms/utils';

const hasPhotoHash = (concert: Concert): concert is Concert & { photoHash: string } => {
  return typeof concert.photoHash === 'string' && concert.photoHash.length > 0;
};

/**
 * Calculate the framed region coordinates based on aspect ratio
 * @param videoWidth - Width of the video in pixels
 * @param videoHeight - Height of the video in pixels
 * @param aspectRatio - Target aspect ratio ('3:2' or '2:3')
 * @returns Coordinates for cropping {x, y, width, height}
 */
export function calculateFramedRegion(
  videoWidth: number,
  videoHeight: number,
  aspectRatio: AspectRatio
): { x: number; y: number; width: number; height: number } {
  const targetRatio = aspectRatio === '3:2' ? 3 / 2 : 2 / 3;
  const videoRatio = videoWidth / videoHeight;

  let frameWidth: number;
  let frameHeight: number;

  if (videoRatio > targetRatio) {
    // Video is wider than target - fit height, crop width
    frameHeight = videoHeight * 0.8; // 80% of viewport
    frameWidth = frameHeight * targetRatio;
  } else {
    // Video is taller than target - fit width, crop height
    frameWidth = videoWidth * 0.8;
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
  } = options;

  const { isEnabled } = useFeatureFlags();

  const [recognizedConcert, setRecognizedConcert] = useState<Concert | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [debugInfo, setDebugInfo] = useState<RecognitionDebugInfo | null>(null);
  const [restartKey, setRestartKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const lastMatchedConcertRef = useRef<Concert | null>(null);
  const matchStartTimeRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);

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
    lastMatchedConcertRef.current = null;
    matchStartTimeRef.current = null;
    frameCountRef.current = 0;
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
      console.log(`  Concerts with hashes: ${concerts.filter((c) => c.photoHash).length}`);
      console.log(
        `  Similarity threshold: ${similarityThreshold} (≥${(((256 - similarityThreshold) / 256) * 100).toFixed(1)}% match)`
      );
      console.log(`  Recognition delay: ${recognitionDelay}ms`);
      console.log(`  Check interval: ${checkInterval}ms`);
      console.log(`  Aspect ratio: ${aspectRatio}`);
      console.log(`  Test Mode: ${isTestMode ? 'ON' : 'OFF'}`);
      if (concerts.length > 0 && concerts.filter((c) => c.photoHash).length > 0) {
        console.log('\n  Available hashes:');
        concerts.forEach((concert) => {
          if (concert.photoHash) {
            console.log(`    ${concert.band}: ${concert.photoHash}`);
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

        // Extract current frame
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          console.error('Failed to get canvas context');
          return;
        }

        // Calculate framed region based on aspect ratio
        const framedRegion = calculateFramedRegion(
          video.videoWidth,
          video.videoHeight,
          aspectRatio
        );

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

        // Apply grayscale conversion if enabled
        if (isEnabled('grayscale-mode')) {
          convertToGrayscale(imageData);
        }

        // Compute hash of current frame
        const currentHash = computeDHash(imageData);

        // Enhanced logging in dev mode or Test Mode
        // Using console.debug() for frame-level logs (can be filtered in DevTools)
        const concertsWithHashes = concerts.filter(hasPhotoHash);

        if (import.meta.env.DEV || isTestMode) {
          console.debug(`\n${'='.repeat(60)}`);
          console.debug(`[Photo Recognition] FRAME ${frameCountRef.current} @ ${timestamp}`);
          console.debug(`Frame Hash: ${currentHash}`);
          console.debug(`Frame Size: ${canvas.width} × ${canvas.height} px (cropped)`);
          console.debug(
            `Cropped Region: x=${framedRegion.x}, y=${framedRegion.y}, w=${framedRegion.width}, h=${framedRegion.height}`
          );
          console.debug(`Aspect Ratio: ${aspectRatio}`);
          console.debug(`Concerts Checked: ${concertsWithHashes.length}`);
          console.debug(
            `Threshold: ${similarityThreshold} (similarity ≥ ${(((256 - similarityThreshold) / 256) * 100).toFixed(1)}%)`
          );
          console.debug('');
        }

        // Find best match among concerts with photo hashes
        let bestMatch: Concert | null = null;
        let bestDistance = Infinity;

        if (import.meta.env.DEV || isTestMode) {
          console.debug('Results:');
        }

        for (const concert of concertsWithHashes) {
          const distance = hammingDistance(currentHash, concert.photoHash);
          const similarity = ((256 - distance) / 256) * 100;

          // Enhanced logging in dev mode or Test Mode
          if (import.meta.env.DEV || isTestMode) {
            const isBest = distance < bestDistance;
            const meetsThreshold = distance <= similarityThreshold;
            const status = meetsThreshold ? (isBest ? '✓' : '~') : '✗';
            console.debug(
              `  ${status} ${concert.band}: distance=${distance}, similarity=${similarity.toFixed(1)}%${isBest ? ' ← BEST MATCH' : ''}`
            );
          }

          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = concert;
          }
        }

        // Update debug info if enabled
        if (enableDebugInfo || isTestMode) {
          const elapsedMs =
            matchStartTimeRef.current && bestMatch && bestDistance <= similarityThreshold
              ? currentTime - matchStartTimeRef.current
              : 0;
          const stabilityInfo =
            matchStartTimeRef.current &&
            bestMatch &&
            bestDistance <= similarityThreshold &&
            elapsedMs > 0
              ? {
                  concert: bestMatch,
                  elapsedMs,
                  remainingMs: Math.max(recognitionDelay - elapsedMs, 0),
                  requiredMs: recognitionDelay,
                  progress: Math.min(elapsedMs / recognitionDelay, 1),
                }
              : null;

          setDebugInfo({
            lastFrameHash: currentHash,
            bestMatch: bestMatch
              ? {
                  concert: bestMatch,
                  distance: bestDistance,
                  similarity: ((256 - bestDistance) / 256) * 100,
                }
              : null,
            lastCheckTime: currentTime,
            concertCount: concertsWithHashes.length,
            frameCount: frameCountRef.current,
            checkInterval,
            aspectRatio,
            frameSize: { width: canvas.width, height: canvas.height },
            stability: stabilityInfo,
            similarityThreshold,
            recognitionDelay,
          });
        }

        // Check if best match meets threshold
        if (bestMatch && bestDistance <= similarityThreshold) {
          const similarity = ((256 - bestDistance) / 256) * 100;

          if (import.meta.env.DEV || isTestMode) {
            console.debug('');
            console.debug(`Match Decision: POTENTIAL MATCH (${bestMatch.band})`);
            console.debug(`  Distance: ${bestDistance} / ${similarityThreshold} threshold`);
            console.debug(`  Similarity: ${similarity.toFixed(1)}%`);
          }

          // Same concert as before?
          if (lastMatchedConcertRef.current?.id === bestMatch.id) {
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
                setRecognizedConcert(bestMatch);
                setIsRecognizing(false);

                if (import.meta.env.DEV || isTestMode) {
                  console.log('');
                  console.log('🎵 RECOGNIZED!', bestMatch.band);
                  console.log('━'.repeat(60));
                }

                lastMatchedConcertRef.current = null;
                matchStartTimeRef.current = null;
              } else {
                setIsRecognizing(true);
              }
            }
          } else {
            // New match, start timing
            lastMatchedConcertRef.current = bestMatch;
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
            if (bestMatch) {
              const similarity = ((256 - bestDistance) / 256) * 100;
              console.debug('');
              console.debug(`Match Decision: NO MATCH (best was ${bestMatch.band})`);
              console.debug(`  Distance: ${bestDistance} > ${similarityThreshold} threshold`);
              console.debug(
                `  Similarity: ${similarity.toFixed(1)}% < required ${(((256 - similarityThreshold) / 256) * 100).toFixed(1)}%`
              );
            } else {
              console.debug('');
              console.debug('Match Decision: NO CANDIDATES');
            }
            console.debug('━'.repeat(60));
          }

          if (lastMatchedConcertRef.current) {
            lastMatchedConcertRef.current = null;
            matchStartTimeRef.current = null;
            setIsRecognizing(false);
          }
        }
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
    isEnabled,
    restartKey,
  ]);

  return {
    recognizedConcert,
    isRecognizing,
    reset,
    debugInfo,
  };
}
