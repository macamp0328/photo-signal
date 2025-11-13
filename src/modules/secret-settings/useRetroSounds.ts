/**
 * Retro Sounds Hook
 *
 * Plays random old-school system sounds when enabled
 * Uses Web Audio API to synthesize retro sounds (no external files needed)
 */

import { useCallback } from 'react';

/**
 * Synthesize a retro beep sound
 */
function playBeep(audioContext: AudioContext, frequency: number, duration: number) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'square'; // Retro square wave

  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

/**
 * Synthesize a retro click sound
 */
function playClick(audioContext: AudioContext) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = 800;
  oscillator.type = 'square';

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.05);
}

/**
 * Synthesize a retro whoosh sound
 */
function playWhoosh(audioContext: AudioContext) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(2000, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
  oscillator.type = 'sawtooth';

  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
}

/**
 * Synthesize a retro dial-up modem sound
 */
function playModem(audioContext: AudioContext) {
  const oscillator1 = audioContext.createOscillator();
  const oscillator2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator1.connect(gainNode);
  oscillator2.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Create warbling frequencies like a modem
  oscillator1.frequency.setValueAtTime(1200, audioContext.currentTime);
  oscillator1.frequency.linearRampToValueAtTime(2200, audioContext.currentTime + 0.5);
  oscillator2.frequency.setValueAtTime(1800, audioContext.currentTime);
  oscillator2.frequency.linearRampToValueAtTime(1000, audioContext.currentTime + 0.5);

  oscillator1.type = 'square';
  oscillator2.type = 'sawtooth';

  gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

  oscillator1.start(audioContext.currentTime);
  oscillator2.start(audioContext.currentTime);
  oscillator1.stop(audioContext.currentTime + 0.5);
  oscillator2.stop(audioContext.currentTime + 0.5);
}

// Module-level singleton for AudioContext
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

const SOUND_FUNCTIONS = [
  () => playBeep(getAudioContext(), 440, 0.1), // A4 note
  () => playBeep(getAudioContext(), 880, 0.1), // A5 note
  () => playBeep(getAudioContext(), 523.25, 0.15), // C5 note
  () => playClick(getAudioContext()),
  () => playWhoosh(getAudioContext()),
  () => playModem(getAudioContext()),
];

/**
 * Hook for playing random retro sounds
 *
 * When enabled, plays random old-school system sounds on various app events.
 * Sounds are synthesized using Web Audio API (no external files needed).
 *
 * @param enabled - Whether retro sounds are enabled
 * @returns Object with playRandomSound function
 *
 * @example
 * ```tsx
 * const { isEnabled } = useFeatureFlags();
 * const { playRandomSound } = useRetroSounds(isEnabled('retro-sounds'));
 *
 * // Play a sound on button click
 * <button onClick={() => playRandomSound()}>Click me</button>
 * ```
 */
export function useRetroSounds(enabled: boolean) {
  /**
   * Play a random retro sound
   */
  const playRandomSound = useCallback(() => {
    if (!enabled) {
      return;
    }

    // Pick a random sound function
    const randomIndex = Math.floor(Math.random() * SOUND_FUNCTIONS.length);
    const soundFunction = SOUND_FUNCTIONS[randomIndex];

    // Play the sound
    try {
      soundFunction();
    } catch (error) {
      console.warn('Failed to play retro sound:', error);
    }
  }, [enabled]);

  return {
    playRandomSound,
  };
}
