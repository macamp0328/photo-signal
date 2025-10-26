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
      <Camera onPhotoRecognized={handlePhotoRecognized} onMovement={handleMovement} />

      <InfoDisplay concert={recognizedConcert} isVisible={showInfo} />

      <AudioPlayer
        audioFile={recognizedConcert?.audioFile || null}
        shouldPlay={playAudio}
        onFadeComplete={handleFadeComplete}
      />
    </div>
import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
    </>
  );
}

export default App;
