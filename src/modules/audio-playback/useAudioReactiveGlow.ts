/**
 * useAudioReactiveGlow
 *
 * Taps Howler's Web Audio context to read low-frequency energy (bass, ~60–200 Hz)
 * and modulates --glow-reactive-scale on :root. This makes the phosphor text-shadow
 * glow breathe subtly with the music's bass when a photo is matched and music plays.
 *
 * Activates only when both isActive and isEnabled are true.
 * Deactivates cleanly (rAF cancelled, CSS var removed, AnalyserNode disconnected).
 * If Howler.ctx is suspended when first called, a statechange listener waits for
 * the AudioContext to resume (after the first user gesture) before activating.
 * No-ops silently if Howler.ctx is unavailable.
 */

import { useEffect, useRef } from 'react';
import * as howlerModule from 'howler';

const GLOW_SCALE_VAR = '--glow-reactive-scale';

// Bass frequency range for energy extraction
const BASS_LOW_HZ = 60;
const BASS_HIGH_HZ = 200;

function getHowlerGlobals(): { ctx: AudioContext; masterGain: GainNode } | undefined {
  try {
    const howler = Reflect.get(howlerModule as object, 'Howler') as
      | { ctx?: AudioContext; masterGain?: GainNode }
      | undefined;
    if (howler?.ctx && howler?.masterGain) {
      return { ctx: howler.ctx, masterGain: howler.masterGain };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function useAudioReactiveGlow(isActive: boolean, isEnabled: boolean): void {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const stopRaf = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const teardown = () => {
      stopRaf();
      document.documentElement.style.removeProperty(GLOW_SCALE_VAR);
      if (analyserRef.current !== null && masterGainRef.current !== null) {
        try {
          masterGainRef.current.disconnect(analyserRef.current);
        } catch {
          // Ignore if already disconnected
        }
        analyserRef.current = null;
        masterGainRef.current = null;
      }
    };

    if (!isActive || !isEnabled) {
      teardown();
      return;
    }

    const globals = getHowlerGlobals();
    if (!globals) {
      return;
    }

    const { ctx, masterGain } = globals;

    const activate = () => {
      // Create and connect analyser once; reused across crossfades
      if (analyserRef.current === null) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        masterGain.connect(analyser);
        analyserRef.current = analyser;
        masterGainRef.current = masterGain;
      }

      const analyser = analyserRef.current;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Pre-compute bass bin range from sample rate
      const binWidth = ctx.sampleRate / analyser.fftSize;
      const startBin = Math.max(0, Math.floor(BASS_LOW_HZ / binWidth));
      const endBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(BASS_HIGH_HZ / binWidth));
      const binCount = Math.max(1, endBin - startBin + 1);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = startBin; i <= endBin; i++) {
          sum += dataArray[i];
        }

        const avg = sum / binCount;
        const scale = 0.85 + (avg / 255) * 0.35;
        document.documentElement.style.setProperty(GLOW_SCALE_VAR, scale.toFixed(3));

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    if (ctx.state === 'running') {
      activate();
      return teardown;
    }

    // AudioContext is suspended (browser requires a user gesture to unlock it).
    // Wait for statechange so the glow activates as soon as audio is unblocked.
    const handleStateChange = () => {
      if (ctx.state === 'running') {
        ctx.removeEventListener('statechange', handleStateChange);
        activate();
      }
    };

    ctx.addEventListener('statechange', handleStateChange);

    return () => {
      ctx.removeEventListener('statechange', handleStateChange);
      teardown();
    };
  }, [isActive, isEnabled]);

  // Ensure cleanup on unmount regardless of state
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      document.documentElement.style.removeProperty(GLOW_SCALE_VAR);
      if (analyserRef.current !== null && masterGainRef.current !== null) {
        try {
          masterGainRef.current.disconnect(analyserRef.current);
        } catch {
          // Ignore
        }
      }
    };
  }, []);
}
