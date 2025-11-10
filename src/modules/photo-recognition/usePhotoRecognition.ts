import { useEffect, useRef, useState, useCallback } from 'react';
import { dataService } from '../../services/data-service';
import type { Concert } from '../../types';
import type { PhotoRecognitionHook, PhotoRecognitionOptions } from './types';
import { computeDHash } from './algorithms/dhash';
import { hammingDistance } from './algorithms/hamming';

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
    recognitionDelay = 1000,
    enabled = true,
    similarityThreshold = 10,
    checkInterval = 1000,
  } = options;

  const [recognizedConcert, setRecognizedConcert] = useState<Concert | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [concerts, setConcerts] = useState<Concert[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const recognitionTimeoutRef = useRef<number | undefined>(undefined);

  // Load concert data
  useEffect(() => {
    dataService
      .getConcerts()
      .then(setConcerts)
      .catch((error) => {
        console.error('Failed to load concert data:', error);
        setConcerts([]);
      });
  }, []);

  // Reset recognition state
  const reset = useCallback(() => {
    setRecognizedConcert(null);
    setIsRecognizing(false);
    if (recognitionTimeoutRef.current) {
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = undefined;
    }
  }, []);

  // Start recognition when stream is available
  useEffect(() => {
    if (!stream || !enabled || concerts.length === 0) {
      return;
    }

    // Create video element to capture stream
    const video = document.createElement('video');
    
    // Try to set srcObject, catch if it fails in test environment
    try {
      video.srcObject = stream;
    } catch (error) {
      // In test environment, this might fail if stream is not a true MediaStream
      console.warn('Failed to set video srcObject:', error);
      return;
    }
    
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;

    // Wait for video to be ready
    video.addEventListener('loadedmetadata', () => {
      video.play().catch((error) => {
        console.error('Failed to play video:', error);
      });
    });

    // Create canvas for frame extraction
    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

    let lastMatchedConcert: Concert | null = null;
    let matchStartTime: number | null = null;

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
        // Extract current frame
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          console.error('Failed to get canvas context');
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Compute hash of current frame
        const currentHash = computeDHash(imageData);

        // Debug logging in dev mode
        if (import.meta.env.DEV) {
          console.log('[Photo Recognition] Frame hash:', currentHash);
        }

        // Find best match among concerts with photo hashes
        let bestMatch: Concert | null = null;
        let bestDistance = Infinity;

        for (const concert of concerts) {
          if (!concert.photoHash) {
            continue;
          }

          const distance = hammingDistance(currentHash, concert.photoHash);

          // Debug logging in dev mode
          if (import.meta.env.DEV) {
            const similarity = ((64 - distance) / 64) * 100;
            console.log(
              `[Photo Recognition] ${concert.band}: distance=${distance}, similarity=${similarity.toFixed(1)}%`
            );
          }

          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = concert;
          }
        }

        // Check if best match meets threshold
        if (bestMatch && bestDistance <= similarityThreshold) {
          // Same concert as before?
          if (lastMatchedConcert?.id === bestMatch.id) {
            // Continue timing
            if (matchStartTime) {
              const elapsed = Date.now() - matchStartTime;

              if (elapsed >= recognitionDelay) {
                // Stable match confirmed!
                setRecognizedConcert(bestMatch);
                setIsRecognizing(false);

                if (import.meta.env.DEV) {
                  console.log('[Photo Recognition] Recognized:', bestMatch.band);
                }

                // Stop checking
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = undefined;
                }

                lastMatchedConcert = null;
                matchStartTime = null;
              } else {
                setIsRecognizing(true);
              }
            }
          } else {
            // New match, start timing
            lastMatchedConcert = bestMatch;
            matchStartTime = Date.now();
            setIsRecognizing(true);

            if (import.meta.env.DEV) {
              console.log('[Photo Recognition] Potential match:', bestMatch.band);
            }
          }
        } else {
          // No match, reset
          if (lastMatchedConcert) {
            lastMatchedConcert = null;
            matchStartTime = null;
            setIsRecognizing(false);

            if (import.meta.env.DEV) {
              console.log('[Photo Recognition] Match lost');
            }
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
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = undefined;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, [stream, enabled, concerts, recognitionDelay, similarityThreshold, checkInterval]);

  return {
    recognizedConcert,
    isRecognizing,
    reset,
  };
}
