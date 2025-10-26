import { useState, useEffect, useCallback } from 'react';
import Camera from './components/Camera';
import AudioPlayer from './components/AudioPlayer';
import InfoDisplay from './components/InfoDisplay';
import type { Concert, ConcertData } from './types';

function App() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [currentConcert, setCurrentConcert] = useState<Concert | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0);
  const [infoOpacity, setInfoOpacity] = useState(0);

  // Load concert data
  useEffect(() => {
    fetch('/data.json')
      .then(res => res.json())
      .then((data: ConcertData) => setConcerts(data.concerts))
      .catch(err => console.error('Error loading concert data:', err));
  }, []);

  const handlePhotoRecognized = useCallback(() => {
    if (concerts.length > 0 && !currentConcert) {
      // Select first concert (in real app, this would be based on image recognition)
      const concert = concerts[0];
      setCurrentConcert(concert);
      setIsPlaying(true);
      setVolume(1);
      setInfoOpacity(1);
    }
  }, [concerts, currentConcert]);

  const handleMotionDetected = useCallback((isMoving: boolean) => {
    if (currentConcert) {
      // Fade out when motion detected, fade in when stable
      setVolume(isMoving ? 0 : 1);
      setInfoOpacity(isMoving ? 0 : 1);
    }
  }, [currentConcert]);

  return (
    <div className="relative w-full h-screen">
      <Camera 
        onPhotoRecognized={handlePhotoRecognized}
        onMotionDetected={handleMotionDetected}
      />
      
      {currentConcert && (
        <>
          <AudioPlayer 
            audioFile={currentConcert.audioFile}
            isPlaying={isPlaying}
            volume={volume}
          />
          <InfoDisplay 
            concert={currentConcert}
            opacity={infoOpacity}
          />
        </>
      )}
    </div>
  );
}

export default App;
