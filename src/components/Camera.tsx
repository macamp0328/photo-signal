import { useEffect, useRef, useState, useCallback } from 'react';
import { Concert } from '../types';

interface CameraProps {
  onPhotoRecognized: (concert: Concert) => void;
  onMovement: () => void;
}

const Camera = ({ onPhotoRecognized, onMovement }: CameraProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const previousFrameData = useRef<ImageData | null>(null);
  const recognitionTimeout = useRef<number | undefined>(undefined);

  // Start camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Rear camera
            aspectRatio: 3 / 2,
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        console.error('Camera error:', err);
        setError('Unable to access camera. Please grant camera permissions.');
        setHasPermission(false);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Detect movement
  const detectMovement = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth / 4; // Lower resolution for performance
    canvas.height = video.videoHeight / 4;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrameData = context.getImageData(0, 0, canvas.width, canvas.height);

    if (previousFrameData.current) {
      let diff = 0;
      const threshold = 30;
      const minDiff = 1000; // Minimum difference to trigger movement

      for (let i = 0; i < currentFrameData.data.length; i += 4) {
        const rDiff = Math.abs(currentFrameData.data[i] - previousFrameData.current.data[i]);
        const gDiff = Math.abs(
          currentFrameData.data[i + 1] - previousFrameData.current.data[i + 1]
        );
        const bDiff = Math.abs(
          currentFrameData.data[i + 2] - previousFrameData.current.data[i + 2]
        );

        if (rDiff > threshold || gDiff > threshold || bDiff > threshold) {
          diff++;
        }
      }

      if (diff > minDiff) {
        onMovement();
      }
    }

    previousFrameData.current = currentFrameData;
  }, [onMovement]);

  // Monitor for movement
  useEffect(() => {
    const interval = setInterval(detectMovement, 500); // Check every 500ms
    return () => clearInterval(interval);
  }, [detectMovement]);

  // Simulated photo recognition - trigger after camera stabilizes
  useEffect(() => {
    if (hasPermission && videoRef.current) {
      // Simulate photo recognition after 3 seconds of "stability"
      recognitionTimeout.current = window.setTimeout(() => {
        // Load data and randomly select a concert (placeholder logic)
        fetch('/data.json')
          .then((res) => res.json())
          .then((data) => {
            if (data.concerts && data.concerts.length > 0) {
              const randomConcert = data.concerts[Math.floor(Math.random() * data.concerts.length)];
              onPhotoRecognized(randomConcert);
            }
          })
          .catch((err) => console.error('Failed to load concert data:', err));
      }, 3000);

      return () => {
        if (recognitionTimeout.current) {
          clearTimeout(recognitionTimeout.current);
        }
      };
    }
  }, [hasPermission, onPhotoRecognized]);

  if (hasPermission === false) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white p-4 text-center">
        <div>
          <p className="text-lg mb-2">Camera Access Required</p>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (hasPermission === null) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <p>Requesting camera access...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
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
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-8 left-0 right-0 text-center text-white text-sm px-4">
        <p className="bg-black bg-opacity-50 inline-block px-4 py-2 rounded">
          Point camera at a photo to play music
        </p>
      </div>
    </div>
  );
};

export default Camera;
