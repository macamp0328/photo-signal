import { useEffect, useRef, useState, useCallback } from 'react';
import type { CameraAccessHook, CameraAccessOptions } from './types';

/**
 * Custom hook for camera access
 *
 * Manages camera permissions and provides MediaStream.
 * Automatically requests rear camera with 3:2 aspect ratio.
 * Cleans up stream on unmount.
 *
 * @param options - Configuration options
 * @returns Camera access state and controls
 */
export function useCameraAccess(options: CameraAccessOptions = {}): CameraAccessHook {
  const { autoStart = true } = options;
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setHasPermission(null);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Rear camera
          aspectRatio: 3 / 2,
          // Advanced constraints for low-light bathroom use case
          // Using 'ideal' to allow graceful fallback if unsupported
          // Some constraints may not be in TS types but are valid per W3C spec
          ...({
            focusMode: { ideal: 'continuous' },
            pointsOfInterest: { ideal: [{ x: 0.5, y: 0.5 }] }, // Center focus
            exposureMode: { ideal: 'continuous' },
            whiteBalanceMode: { ideal: 'continuous' },
            brightness: { ideal: 1.2 }, // Slight boost for low light
            contrast: { ideal: 1.2 }, // Improve visibility
          } as unknown as MediaTrackConstraints),
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermission(true);

      // Log applied settings for debugging (helps understand browser support)
      if (process.env.NODE_ENV === 'development') {
        const track = mediaStream.getVideoTracks()[0];
        const settings = track?.getSettings();
        console.log('Camera settings applied:', settings);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please grant camera permissions.');
      setHasPermission(false);
    }
  }, []);

  // Start camera on mount if autoStart is true
  useEffect(() => {
    // Only auto-start if autoStart option is true
    if (!autoStart) {
      return;
    }

    let cancelled = false;

    const initCamera = async () => {
      try {
        setError(null);
        setHasPermission(null);

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Rear camera
            aspectRatio: 3 / 2,
            // Advanced constraints for low-light bathroom use case
            // Using 'ideal' to allow graceful fallback if unsupported
            // Some constraints may not be in TS types but are valid per W3C spec
            ...({
              focusMode: { ideal: 'continuous' },
              pointsOfInterest: { ideal: [{ x: 0.5, y: 0.5 }] }, // Center focus
              exposureMode: { ideal: 'continuous' },
              whiteBalanceMode: { ideal: 'continuous' },
              brightness: { ideal: 1.2 }, // Slight boost for low light
              contrast: { ideal: 1.2 }, // Improve visibility
            } as unknown as MediaTrackConstraints),
          },
          audio: false,
        });

        if (!cancelled) {
          streamRef.current = mediaStream;
          setStream(mediaStream);
          setHasPermission(true);

          // Log applied settings for debugging (helps understand browser support)
          if (process.env.NODE_ENV === 'development') {
            const track = mediaStream.getVideoTracks()[0];
            const settings = track?.getSettings();
            console.log('Camera settings applied:', settings);
          }
        } else {
          // Clean up if effect was cancelled
          mediaStream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Camera access error:', err);
          setError('Unable to access camera. Please grant camera permissions.');
          setHasPermission(false);
        }
      }
    };

    void initCamera();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [autoStart]);

  const retry = useCallback(() => {
    startCamera();
  }, [startCamera]);

  return {
    stream,
    error,
    hasPermission,
    retry,
  };
}
