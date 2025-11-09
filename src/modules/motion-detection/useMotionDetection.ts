import { useEffect, useRef, useState, useCallback } from 'react';
import type { MotionDetectionHook, MotionDetectionOptions } from './types';

/**
 * Custom hook for motion detection
 * 
 * Analyzes video stream frames to detect camera movement.
 * Uses efficient pixel difference algorithm with configurable sensitivity.
 * 
 * @param stream - Camera video stream from camera-access module
 * @param options - Configuration options
 * @returns Motion detection state and controls
 */
export function useMotionDetection(
  stream: MediaStream | null,
  options: MotionDetectionOptions = {}
): MotionDetectionHook {
  const {
    sensitivity: initialSensitivity = 50,
    checkInterval = 500,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameData = useRef<ImageData | null>(null);
  
  const [isMoving, setIsMoving] = useState(false);
  const [sensitivity, setSensitivity] = useState(initialSensitivity);

  // Create hidden video element for frame capture
  useEffect(() => {
    if (!stream) return;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;

    const canvas = document.createElement('canvas');
    canvasRef.current = canvas;

    return () => {
      videoRef.current = null;
      canvasRef.current = null;
      previousFrameData.current = null;
    };
  }, [stream]);

  // Motion detection function
  const detectMovement = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return;
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    // Use low resolution for performance (4x downscale)
    const width = Math.floor(video.videoWidth / 4) || 80;
    const height = Math.floor(video.videoHeight / 4) || 60;
    
    canvas.width = width;
    canvas.height = height;

    // Capture current frame
    context.drawImage(video, 0, 0, width, height);
    const currentFrameData = context.getImageData(0, 0, width, height);

    if (previousFrameData.current) {
      let diffCount = 0;
      
      // Calculate threshold based on sensitivity (inverse: higher sensitivity = lower threshold)
      const pixelThreshold = 30 + (100 - sensitivity) * 0.5;
      const minDiffPixels = 500 + (100 - sensitivity) * 10;

      // Compare pixels
      for (let i = 0; i < currentFrameData.data.length; i += 4) {
        const rDiff = Math.abs(
          currentFrameData.data[i] - previousFrameData.current.data[i]
        );
        const gDiff = Math.abs(
          currentFrameData.data[i + 1] - previousFrameData.current.data[i + 1]
        );
        const bDiff = Math.abs(
          currentFrameData.data[i + 2] - previousFrameData.current.data[i + 2]
        );

        if (rDiff > pixelThreshold || gDiff > pixelThreshold || bDiff > pixelThreshold) {
          diffCount++;
        }
      }

      setIsMoving(diffCount > minDiffPixels);
    }

    previousFrameData.current = currentFrameData;
  }, [sensitivity]);

  // Set up interval for motion detection
  useEffect(() => {
    if (!stream) return;

    const interval = setInterval(detectMovement, checkInterval);
    return () => clearInterval(interval);
  }, [stream, detectMovement, checkInterval]);

  return {
    isMoving,
    sensitivity,
    setSensitivity,
  };
}
