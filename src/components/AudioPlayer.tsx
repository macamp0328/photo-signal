import { useEffect, useRef, useState } from 'react';
import { Howl } from 'howler';

interface AudioPlayerProps {
  audioFile: string | null;
  shouldPlay: boolean;
  onFadeComplete?: () => void;
}

const AudioPlayer = ({ audioFile, shouldPlay, onFadeComplete }: AudioPlayerProps) => {
  const soundRef = useRef<Howl | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Cleanup previous sound
    if (soundRef.current) {
      soundRef.current.unload();
      soundRef.current = null;
    }

    // Create new sound if audio file is provided
    if (audioFile && shouldPlay) {
      soundRef.current = new Howl({
        src: [audioFile],
        html5: true,
        volume: 0.8,
        onplay: () => setIsPlaying(true),
        onend: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false),
        onloaderror: (_id, error) => {
          console.error('Audio load error:', error);
          console.warn('Audio file not found. Please add an MP3 file at public/audio/sample.mp3');
          // Still mark as playing to allow fade out logic
          setIsPlaying(true);
        },
        onplayerror: (_id, error) => {
          console.error('Audio play error:', error);
        },
      });

      soundRef.current.play();
    }

    return () => {
      if (soundRef.current) {
        soundRef.current.unload();
        soundRef.current = null;
      }
    };
  }, [audioFile, shouldPlay]);

  // Fade out when shouldPlay becomes false
  useEffect(() => {
    if (!shouldPlay && soundRef.current && isPlaying) {
      soundRef.current.fade(soundRef.current.volume(), 0, 1000);
      
      setTimeout(() => {
        if (soundRef.current) {
          soundRef.current.stop();
        }
        if (onFadeComplete) {
          onFadeComplete();
        }
      }, 1000);
    }
  }, [shouldPlay, isPlaying, onFadeComplete]);

  return null; // This is a headless component
};

export default AudioPlayer;
