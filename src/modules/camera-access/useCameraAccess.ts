import { useEffect, useRef, useState, useCallback } from 'react';
import type { CameraAccessHook } from './types';

/**
 * Custom hook for camera access
 *
 * Manages camera permissions and provides MediaStream.
 * Automatically requests rear camera with 3:2 aspect ratio.
 * Cleans up stream on unmount.
 *
 * @returns Camera access state and controls
 */
export function useCameraAccess(): CameraAccessHook {
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
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermission(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please grant camera permissions.');
      setHasPermission(false);
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    let cancelled = false;

    const initCamera = async () => {
      try {
        setError(null);
        setHasPermission(null);

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Rear camera
            aspectRatio: 3 / 2,
          },
          audio: false,
        });

        if (!cancelled) {
          streamRef.current = mediaStream;
          setStream(mediaStream);
          setHasPermission(true);
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
  }, []);

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
