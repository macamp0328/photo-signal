import { useEffect, useRef } from 'react';
import type { CameraViewProps } from './types';

/**
 * Camera View Component
 * 
 * Pure UI component for displaying camera feed with overlay.
 */
export function CameraView({
  stream,
  error,
  hasPermission,
  onRetry,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Permission denied state
  if (hasPermission === false) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white p-4 text-center">
        <div>
          <p className="text-lg mb-2">Camera Access Required</p>
          <p className="text-sm text-gray-400 mb-4">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (hasPermission === null || !stream) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <p>Requesting camera access...</p>
      </div>
    );
  }

  // Camera active state
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-0 left-0 w-full h-full object-cover"
      />

      {/* 3:2 Aspect Ratio Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative" style={{ width: '90%', maxWidth: '600px' }}>
          <div style={{ paddingBottom: '66.67%' }} className="relative">
            <div className="absolute inset-0 border-2 border-white border-opacity-50 rounded-lg shadow-lg">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-8 left-0 right-0 text-center text-white text-sm px-4 pointer-events-none">
        <p className="bg-black bg-opacity-50 inline-block px-4 py-2 rounded">
          Point camera at a photo to play music
        </p>
      </div>
    </div>
  );
}
