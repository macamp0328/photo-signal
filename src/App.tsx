import { useState, useCallback } from 'react';
import Camera from './components/Camera';
import InfoDisplay from './components/InfoDisplay';
import AudioPlayer from './components/AudioPlayer';
import { Concert } from './types';
import './index.css';

function App() {
  const [recognizedConcert, setRecognizedConcert] = useState<Concert | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [playAudio, setPlayAudio] = useState(false);

  const handlePhotoRecognized = useCallback((concert: Concert) => {
    console.log('Photo recognized:', concert);
    setRecognizedConcert(concert);
    setShowInfo(true);
    setPlayAudio(true);
  }, []);

  const handleMovement = useCallback(() => {
    console.log('Movement detected');
    if (playAudio) {
      setPlayAudio(false);
      // Keep info visible briefly during fade out
      setTimeout(() => {
        setShowInfo(false);
      }, 500);
    }
  }, [playAudio]);

  const handleFadeComplete = useCallback(() => {
    console.log('Audio fade complete');
    setRecognizedConcert(null);
  }, []);

  return (
    <div className="w-full h-full">
      <Camera 
        onPhotoRecognized={handlePhotoRecognized}
        onMovement={handleMovement}
      />
      
      <InfoDisplay 
        concert={recognizedConcert}
        isVisible={showInfo}
      />
      
      <AudioPlayer 
        audioFile={recognizedConcert?.audioFile || null}
        shouldPlay={playAudio}
        onFadeComplete={handleFadeComplete}
      />
    </div>
  );
}

export default App;
