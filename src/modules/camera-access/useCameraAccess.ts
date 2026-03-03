import { useEffect, useRef, useState, useCallback } from 'react';
import type { TapIntent } from '../../types';
import type { CameraAccessHook, CameraAccessOptions, TapFocusResult } from './types';

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

interface TapFocusCapabilities {
  supportsPointsOfInterest: boolean;
  focusMode: string | null;
  exposureMode: string | null;
}

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

const getTapFocusCapabilities = (track: MediaStreamTrack): TapFocusCapabilities => {
  const rawCapabilities = track.getCapabilities?.() as Record<string, unknown> | undefined;
  if (!rawCapabilities) {
    return {
      supportsPointsOfInterest: false,
      focusMode: null,
      exposureMode: null,
    };
  }

  const focusMode = rawCapabilities.focusMode;
  const exposureMode = rawCapabilities.exposureMode;
  const pointsOfInterest = rawCapabilities.pointsOfInterest;

  const focusModes = Array.isArray(focusMode)
    ? focusMode.filter((mode): mode is string => typeof mode === 'string')
    : [];
  const exposureModes = Array.isArray(exposureMode)
    ? exposureMode.filter((mode): mode is string => typeof mode === 'string')
    : [];

  return {
    supportsPointsOfInterest: Boolean(pointsOfInterest),
    focusMode: focusModes.includes('continuous') ? 'continuous' : (focusModes[0] ?? null),
    exposureMode: exposureModes.includes('continuous') ? 'continuous' : (exposureModes[0] ?? null),
  };
};

const buildTapFocusConstraintCandidates = (
  tap: TapIntent,
  capabilities: TapFocusCapabilities
): MediaTrackConstraints[] => {
  const fullConstraintSet: Record<string, unknown> = {};

  if (capabilities.supportsPointsOfInterest) {
    fullConstraintSet.pointsOfInterest = [{ x: tap.point.x, y: tap.point.y }];
  }

  if (capabilities.focusMode) {
    fullConstraintSet.focusMode = capabilities.focusMode;
  }

  if (capabilities.exposureMode) {
    fullConstraintSet.exposureMode = capabilities.exposureMode;
  }

  if (Object.keys(fullConstraintSet).length === 0) {
    return [];
  }

  const constraints: MediaTrackConstraints[] = [
    {
      advanced: [fullConstraintSet as unknown as MediaTrackConstraintSet],
    },
  ];

  if (
    capabilities.supportsPointsOfInterest &&
    (capabilities.focusMode !== null || capabilities.exposureMode !== null)
  ) {
    constraints.push({
      advanced: [
        {
          pointsOfInterest: [{ x: tap.point.x, y: tap.point.y }],
        } as unknown as MediaTrackConstraintSet,
      ],
    });
  }

  return constraints;
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

  const requestTapFocus = useCallback(async (tap: TapIntent): Promise<TapFocusResult> => {
    if (!streamRef.current) {
      return { status: 'not-active', message: 'Camera stream is not active' };
    }

    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) {
      return { status: 'no-track', message: 'No active video track available' };
    }

    const tapFocusCapabilities = getTapFocusCapabilities(videoTrack);
    const constraintCandidates = buildTapFocusConstraintCandidates(tap, tapFocusCapabilities);

    if (constraintCandidates.length === 0) {
      return { status: 'unsupported', message: 'Track capabilities do not expose focus controls' };
    }

    let lastError: unknown = null;

    for (const constraintCandidate of constraintCandidates) {
      try {
        await videoTrack.applyConstraints(constraintCandidate);
        logCameraSettings(streamRef.current);
        return { status: 'applied' };
      } catch (error) {
        lastError = error;
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : 'Unknown applyConstraints error';
    return { status: 'failed', message };
  }, []);

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
    requestTapFocus,
  };
}
