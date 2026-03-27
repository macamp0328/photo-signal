/**
 * useAudioReactiveGlow
 *
 * Taps Howler's Web Audio context to read low-frequency energy (bass, ~60–200 Hz)
 * and modulates --glow-reactive-scale on :root. This makes the phosphor text-shadow
 * glow breathe subtly with the music's bass when a photo is matched and music plays.
 *
 * Activates only when both isActive and isEnabled are true.
 * Deactivates cleanly (rAF cancelled, CSS vars removed, nodes disconnected).
 *
 * Supports both Howler audio modes:
 *   - HTML5 audio (html5: true): taps the playing <audio> element via
 *     createMediaElementSource so the Web Audio AnalyserNode can read frequency data.
 *     A WeakMap prevents creating duplicate MediaElementSource nodes per element.
 *   - Web Audio (default): connects directly to Howler's masterGain node (fallback).
 *
 * AudioContext resume: called proactively when suspended, since activation only occurs
 * after a user gesture (matched + playing state requires prior interaction).
 *
 * No-ops silently if Howler.ctx is unavailable or ctx.resume() fails.
 */

import { useEffect, useRef } from 'react';
import * as howlerModule from 'howler';

const GLOW_SCALE_VAR = '--glow-reactive-scale';
const GLOW_RING_SCALE_VAR = '--glow-reactive-scale-ring';

// Bass frequency range for energy extraction
const BASS_LOW_HZ = 60;
const BASS_HIGH_HZ = 200;

// Track MediaElementSource nodes per audio element to avoid creating duplicates.
// Each HTMLAudioElement can only have one MediaElementSource in a given AudioContext.
// WeakMap so entries are GC'd when Howl instances are destroyed.
const elementSourceMap = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

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

/**
 * Finds the HTMLAudioElement currently playing in a Howl that uses HTML5 audio
 * (i.e., created with `html5: true`). Returns undefined if no such element exists
 * or if Howler is using Web Audio for all active sounds.
 */
function getPlayingHtml5AudioElement(): HTMLAudioElement | undefined {
  try {
    const howler = Reflect.get(howlerModule as object, 'Howler') as
      | {
          _howls?: Array<{
            playing?: () => boolean;
            _webAudio?: boolean;
            _sounds?: Array<{ _node?: unknown }>;
          }>;
        }
      | undefined;
    const howl = howler?._howls?.find((h) => !h._webAudio && h.playing?.());
    const node = howl?._sounds?.[0]?._node;
    return node instanceof HTMLAudioElement ? node : undefined;
  } catch {
    return undefined;
  }
}

export function useAudioReactiveGlow(isActive: boolean, isEnabled: boolean): void {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const stopRaf = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const teardown = () => {
      stopRaf();
      document.documentElement.style.removeProperty(GLOW_SCALE_VAR);
      document.documentElement.style.removeProperty(GLOW_RING_SCALE_VAR);
      const analyser = analyserRef.current;
      if (analyser !== null) {
        if (masterGainRef.current !== null) {
          try {
            masterGainRef.current.disconnect(analyser);
          } catch {
            // Ignore if already disconnected
          }
          masterGainRef.current = null;
        }
        if (mediaSourceRef.current !== null) {
          try {
            mediaSourceRef.current.disconnect(analyser);
          } catch {
            // Ignore if already disconnected
          }
          mediaSourceRef.current = null;
        }
        try {
          analyser.disconnect();
        } catch {
          // Ignore
        }
        analyserRef.current = null;
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

    const doActivate = () => {
      // HTML5 audio path: Howler was created with html5:true so audio bypasses
      // the Web Audio graph. Tap the playing <audio> element directly via
      // createMediaElementSource so we can read frequency data from an AnalyserNode.
      const audioElement = getPlayingHtml5AudioElement();
      if (audioElement) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;

        // Reuse existing source — createMediaElementSource can only be called once per element.
        let source = elementSourceMap.get(audioElement);
        if (!source) {
          try {
            source = ctx.createMediaElementSource(audioElement);
            source.connect(ctx.destination); // preserve audio output
            elementSourceMap.set(audioElement, source);
          } catch {
            // Failed to create source — bail without affecting audio playback
            try {
              analyser.disconnect();
            } catch {
              // Ignore
            }
            return;
          }
        }

        source.connect(analyser);
        analyserRef.current = analyser;
        mediaSourceRef.current = source;
        startLoop(analyser);
        return;
      }

      // Web Audio path (fallback): connect directly to Howler's masterGain.
      // Create and connect analyser once; reused until teardown.
      if (analyserRef.current === null) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        masterGain.connect(analyser);
        analyserRef.current = analyser;
        masterGainRef.current = masterGain;
        startLoop(analyser);
      }
    };

    const startLoop = (analyser: AnalyserNode) => {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Pre-compute bass bin range from sample rate
      const binWidth = ctx.sampleRate / analyser.fftSize;
      const startBin = Math.max(0, Math.floor(BASS_LOW_HZ / binWidth));
      const endBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(BASS_HIGH_HZ / binWidth));
      const binCount = Math.max(1, endBin - startBin + 1);

      const tick = () => {
        // Chrome may auto-suspend the AudioContext mid-session (e.g. when it detects
        // the HTML5 audio element is providing output natively). Resume and retry next
        // frame — once running, the AnalyserNode will read real frequency data.
        if (ctx.state !== 'running') {
          ctx.resume().catch(() => {});
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = startBin; i <= endBin; i++) {
          sum += dataArray[i];
        }

        const avg = sum / binCount;
        // Text glow: 0.6–1.8 (wider range for perceptible breathing on band name / meta)
        const scale = 0.6 + (avg / 255) * 1.2;
        // Ring glow: 0.4–2.0 (more dramatic for the phosphor signal indicator)
        const ringScale = 0.4 + (avg / 255) * 1.6;
        document.documentElement.style.setProperty(GLOW_SCALE_VAR, scale.toFixed(3));
        document.documentElement.style.setProperty(GLOW_RING_SCALE_VAR, ringScale.toFixed(3));

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    // Proactively resume the AudioContext — safe after a user gesture.
    // The matched+playing state guarantees prior interaction (camera + audio start).
    // Use .then()/.catch() rather than async/await so the effect body stays synchronous
    // and predictable under React StrictMode's double-invocation of effects.
    if (ctx.state === 'running') {
      doActivate();
    } else {
      ctx
        .resume()
        .then(() => {
          if (!mounted) return;
          doActivate();
          // Chrome may auto-suspend the ctx between resume() resolving and the audio source
          // being connected. Resume again after connecting to ensure the ctx stays running.
          if (ctx.state !== 'running') {
            ctx.resume().catch(() => {});
          }
        })
        .catch(() => {
          // resume() failed — leave audio untouched, glow simply won't activate
        });
    }

    return () => {
      mounted = false;
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
      document.documentElement.style.removeProperty(GLOW_RING_SCALE_VAR);
      if (analyserRef.current !== null) {
        try {
          analyserRef.current.disconnect();
        } catch {
          // Ignore
        }
      }
    };
  }, []);
}
