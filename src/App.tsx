/**
 * Photo Signal App - Modular Architecture
 *
 * This is the orchestrator that wires together independent modules.
 * Each module has a single responsibility and clear contract.
 *
 * Modules can be developed in parallel by different AI agents
 * without conflicts or coupling.
 */

import { useEffect, useState } from 'react';
import { useCameraAccess } from './modules/camera-access';
import { useMotionDetection } from './modules/motion-detection';
import { usePhotoRecognition } from './modules/photo-recognition';
import { useAudioPlayback } from './modules/audio-playback';
import { CameraView } from './modules/camera-view';
import { InfoDisplay } from './modules/concert-info';
import { GalleryLayout } from './modules/gallery-layout';
import { useTripleTap, SecretSettings } from './modules/secret-settings';
import './index.css';

function App() {
  // State for landing view vs. active camera view
  const [isActive, setIsActive] = useState(false);

  // State for secret settings menu
  const [showSecretSettings, setShowSecretSettings] = useState(false);

  // Module: Secret Settings - Triple-tap detection
  useTripleTap({
    onTripleTap: () => {
      setShowSecretSettings(true);
    },
  });

  // Module: Camera Access (only initialize when active)
  const { stream, error, hasPermission, retry } = useCameraAccess({
    autoStart: isActive,
  });

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

  // Handle activation from landing view
  const handleActivate = () => {
    setIsActive(true);
  };

  // Render camera view
  const cameraView = (
    <CameraView stream={stream} error={error} hasPermission={hasPermission} onRetry={retry} />
  );

  // Render info display
  const infoDisplay = (
    <InfoDisplay concert={recognizedConcert} isVisible={!!recognizedConcert && isPlaying} />
  );

  return (
    <>
      <GalleryLayout
        isActive={isActive}
        cameraView={cameraView}
        infoDisplay={infoDisplay}
        onActivate={handleActivate}
      />
      <SecretSettings isVisible={showSecretSettings} onClose={() => setShowSecretSettings(false)} />
    </>
  );
}

export default App;
