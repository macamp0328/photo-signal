/**
 * Photo Signal App - Modular Architecture
 * 
 * This is the orchestrator that wires together independent modules.
 * Each module has a single responsibility and clear contract.
 * 
 * Modules can be developed in parallel by different AI agents
 * without conflicts or coupling.
 */

import { useEffect } from 'react';
import { useCameraAccess } from './modules/camera-access';
import { useMotionDetection } from './modules/motion-detection';
import { usePhotoRecognition } from './modules/photo-recognition';
import { useAudioPlayback } from './modules/audio-playback';
import { CameraView } from './modules/camera-view';
import { InfoDisplay } from './modules/concert-info';
import './index.css';

function App() {
  // Module: Camera Access
  const { stream, error, hasPermission, retry } = useCameraAccess();

  // Module: Motion Detection
  const { isMoving } = useMotionDetection(stream, {
    sensitivity: 50,
    checkInterval: 500,
  });

  // Module: Photo Recognition
  const { recognizedConcert, reset: resetRecognition } = usePhotoRecognition(stream, {
    recognitionDelay: 3000,
  });

  // Module: Audio Playback
  const { play, fadeOut, isPlaying } = useAudioPlayback({
    volume: 0.8,
    fadeTime: 1000,
  });

  // Orchestration Logic
  // Play audio when photo is recognized
  useEffect(() => {
    if (recognizedConcert) {
      console.log('Photo recognized:', recognizedConcert.band);
      play(recognizedConcert.audioFile);
    }
  }, [recognizedConcert, play]);

  // Fade out audio when movement is detected
  useEffect(() => {
    if (isMoving && isPlaying) {
      console.log('Movement detected, fading out');
      fadeOut();
      
      // Reset recognition after fade completes
      setTimeout(() => {
        resetRecognition();
      }, 1500);
    }
  }, [isMoving, isPlaying, fadeOut, resetRecognition]);

  return (
    <div className="w-full h-full">
      {/* Camera View with Overlay */}
      <CameraView
        stream={stream}
        error={error}
        hasPermission={hasPermission}
        onRetry={retry}
      />

      {/* Concert Info Display */}
      <InfoDisplay
        concert={recognizedConcert}
        isVisible={!!recognizedConcert && isPlaying}
        position="bottom"
      />
    </div>
  );
}

export default App;
