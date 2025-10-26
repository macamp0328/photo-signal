import { useEffect, useRef } from 'react';
import { Howl } from 'howler';

interface AudioPlayerProps {
  audioFile: string;
  isPlaying: boolean;
  volume: number;
}

export default function AudioPlayer({ audioFile, isPlaying, volume }: AudioPlayerProps) {
  const soundRef = useRef<Howl | null>(null);

  useEffect(() => {
    // Initialize Howler sound
    soundRef.current = new Howl({
      src: [audioFile],
      loop: true,
      volume: 0,
    });

    return () => {
      // Cleanup on unmount
      if (soundRef.current) {
        soundRef.current.unload();
      }
    };
  }, [audioFile]);

  useEffect(() => {
    if (!soundRef.current) return;

    if (isPlaying) {
      soundRef.current.play();
    } else {
      soundRef.current.stop();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.fade(soundRef.current.volume(), volume, 500);
    }
  }, [volume]);

  return null;
}
