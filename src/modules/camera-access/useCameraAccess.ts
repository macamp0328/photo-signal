import { useEffect, useRef, useState, useCallback } from 'react';
import type { CameraAccessHook, CameraAccessOptions } from './types';

const extendedImportMeta = import.meta as ImportMeta & {
  vitest?: unknown;
  env?: {
    MODE?: string;
  };
};

const isVitestEnvironment =
  Boolean(extendedImportMeta.vitest) ||
  (typeof process !== 'undefined' && process.env?.VITEST === 'true');

const resolvedMode = extendedImportMeta.env?.MODE ?? process.env?.NODE_ENV ?? 'development';

const shouldLogCameraSettings = resolvedMode === 'development' && !isVitestEnvironment;

/**
 * Get camera constraints for getUserMedia
 * @returns MediaStream constraints optimized for low-light conditions
 */
const getCameraConstraints = (): MediaStreamConstraints => ({
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

/**
 * Log camera settings in development mode
 * @param mediaStream - The media stream to log settings for
 */
const logCameraSettings = (mediaStream: MediaStream) => {
  if (shouldLogCameraSettings) {
    const track = mediaStream.getVideoTracks()[0];
    const settings = track?.getSettings();
    console.log('Camera settings applied:', settings);
  }
};

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

  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setStream(null);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setHasPermission(null);

      stopCurrentStream();

      const mediaStream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermission(true);

      logCameraSettings(mediaStream);
    } catch (err) {
      console.error('Camera access error:', err);
      stopCurrentStream();
      setError('Unable to access camera. Please grant camera permissions.');
      setHasPermission(false);
    }
  }, [stopCurrentStream]);

  // Start camera on mount if autoStart is true
  useEffect(() => {
    // Only auto-start if autoStart option is true
    if (!autoStart) {
      stopCurrentStream();
      return;
    }

    let cancelled = false;

    const initCamera = async () => {
      try {
        setError(null);
        setHasPermission(null);

        const mediaStream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());

        if (!cancelled) {
          streamRef.current = mediaStream;
          setStream(mediaStream);
          setHasPermission(true);

          logCameraSettings(mediaStream);
        } else {
          // Clean up if effect was cancelled
          mediaStream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Camera access error:', err);
          stopCurrentStream();
          setError('Unable to access camera. Please grant camera permissions.');
          setHasPermission(false);
        }
      }
    };

    void initCamera();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      stopCurrentStream();
    };
  }, [autoStart, stopCurrentStream]);

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
