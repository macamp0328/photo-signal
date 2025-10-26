import { useEffect, useRef, useState } from 'react';

interface CameraProps {
  onPhotoRecognized: () => void;
  onMotionDetected: (isMoving: boolean) => void;
}

export default function Camera({ onPhotoRecognized, onMotionDetected }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const previousFrameRef = useRef<ImageData | null>(null);
  const recognitionTimerRef = useRef<number | null>(null);
  const motionCheckIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Use rear camera on mobile
            width: { ideal: 1920 },
            height: { ideal: 1280 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Camera access denied or not available');
        setHasPermission(false);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (recognitionTimerRef.current) {
        clearTimeout(recognitionTimerRef.current);
      }
      if (motionCheckIntervalRef.current) {
        clearInterval(motionCheckIntervalRef.current);
      }
    };
  }, []);

  // Motion detection logic
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || hasPermission !== true) return;

    const detectMotion = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const currentFrame = context.getImageData(0, 0, canvas.width, canvas.height);

      if (previousFrameRef.current) {
        // Calculate difference between frames
        let diff = 0;
        const threshold = 30;
        const sampleRate = 10; // Check every 10th pixel for performance

        for (let i = 0; i < currentFrame.data.length; i += 4 * sampleRate) {
          const r = Math.abs(currentFrame.data[i] - previousFrameRef.current.data[i]);
          const g = Math.abs(currentFrame.data[i + 1] - previousFrameRef.current.data[i + 1]);
          const b = Math.abs(currentFrame.data[i + 2] - previousFrameRef.current.data[i + 2]);
          
          if (r + g + b > threshold) {
            diff++;
          }
        }

        // If significant difference, consider it motion
        const motionThreshold = 50;
        onMotionDetected(diff > motionThreshold);
      }

      previousFrameRef.current = currentFrame;
    };

    // Check for motion every 200ms
    motionCheckIntervalRef.current = setInterval(detectMotion, 200);

    return () => {
      if (motionCheckIntervalRef.current) {
        clearInterval(motionCheckIntervalRef.current);
      }
    };
  }, [hasPermission, onMotionDetected]);

  // Placeholder photo recognition (triggers after 3 seconds of stability)
  useEffect(() => {
    if (hasPermission === true) {
      recognitionTimerRef.current = setTimeout(() => {
        onPhotoRecognized();
      }, 3000);
    }

    return () => {
      if (recognitionTimerRef.current) {
        clearTimeout(recognitionTimerRef.current);
      }
    };
  }, [hasPermission, onPhotoRecognized]);

  if (hasPermission === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p className="text-xl">Requesting camera access...</p>
      </div>
    );
  }

  if (hasPermission === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center px-6">
          <p className="text-xl mb-4">Camera access required</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute top-0 left-0 w-full h-full object-cover"
      />
      
      {/* 3:2 Aspect Ratio Overlay Guide */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="border-4 border-white border-opacity-50 rounded-lg"
          style={{
            width: '80%',
            aspectRatio: '3 / 2',
            maxWidth: '600px',
          }}
        >
          <div className="absolute top-2 left-2 right-2 bottom-2 border-2 border-white border-opacity-30 rounded-md" />
        </div>
      </div>

      {/* Hidden canvas for motion detection */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
