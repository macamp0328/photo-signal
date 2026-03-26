import { useEffect, useMemo, useState } from 'react';
import type { PowerOnIntroProps } from './types';
import styles from './PowerOnIntro.module.css';

type IntroPhase = 'black' | 'flare' | 'warm' | 'tune' | 'handoff';

const FULL_SEQUENCE = [
  { phase: 'black' as const, at: 0, label: 'Dead air.' },
  { phase: 'flare' as const, at: 900, label: 'Catching current.' },
  { phase: 'warm' as const, at: 2600, label: 'Warming cathodes.' },
  { phase: 'tune' as const, at: 9200, label: 'Finding frequency.' },
  { phase: 'handoff' as const, at: 14500, label: 'Signal stable.' },
];

const REDUCED_SEQUENCE = [{ phase: 'handoff' as const, at: 0, label: 'Signal stable.' }];

const FULL_DURATION_MS = 17000;
const REDUCED_DURATION_MS = 1200;

type AudioContextConstructor = typeof AudioContext;

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: AudioContextConstructor;
}

interface AudioParamLike {
  setValueAtTime?: (value: number, startTime: number) => void;
  linearRampToValueAtTime?: (value: number, endTime: number) => void;
  exponentialRampToValueAtTime?: (value: number, endTime: number) => void;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => {
      setPrefersReducedMotion(query.matches);
    };

    handleChange();

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }

    query.addListener(handleChange);
    return () => query.removeListener(handleChange);
  }, []);

  return prefersReducedMotion;
}

function playStartupHum(durationMs: number) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const audioWindow = window as WindowWithWebkitAudio;
  const AudioCtor = window.AudioContext ?? audioWindow.webkitAudioContext;

  if (!AudioCtor) {
    return () => {};
  }

  const context = new AudioCtor();

  if (
    typeof context.createGain !== 'function' ||
    typeof context.createOscillator !== 'function' ||
    !context.destination
  ) {
    return () => {};
  }

  const gainNode = context.createGain();
  const primaryOscillator = context.createOscillator();
  const secondaryOscillator = context.createOscillator();
  const tremoloOscillator = context.createOscillator();
  const tremoloGain = context.createGain();
  let stopTimeoutId: number | null = null;
  let cleanedUp = false;

  primaryOscillator.type = 'sawtooth';
  primaryOscillator.frequency.setValueAtTime(58, context.currentTime);
  secondaryOscillator.type = 'triangle';
  secondaryOscillator.frequency.setValueAtTime(117, context.currentTime);
  tremoloOscillator.type = 'sine';
  tremoloOscillator.frequency.setValueAtTime(0.16, context.currentTime);

  const setValueAtTime = (param: AudioParamLike, value: number, time: number) => {
    param.setValueAtTime?.(value, time);
  };

  const linearRampToValueAtTime = (param: AudioParamLike, value: number, time: number) => {
    if (typeof param.linearRampToValueAtTime === 'function') {
      param.linearRampToValueAtTime(value, time);
      return;
    }

    setValueAtTime(param, value, time);
  };

  const exponentialRampToValueAtTime = (param: AudioParamLike, value: number, time: number) => {
    if (typeof param.exponentialRampToValueAtTime === 'function') {
      param.exponentialRampToValueAtTime(value, time);
      return;
    }

    setValueAtTime(param, value, time);
  };

  setValueAtTime(gainNode.gain, 0.0001, context.currentTime);
  linearRampToValueAtTime(gainNode.gain, 0.03, context.currentTime + 0.9);
  linearRampToValueAtTime(
    gainNode.gain,
    0.018,
    context.currentTime + Math.max(durationMs / 1000 - 1.2, 1.2)
  );
  exponentialRampToValueAtTime(
    gainNode.gain,
    0.0001,
    context.currentTime + Math.max(durationMs / 1000 - 0.08, 0.3)
  );

  setValueAtTime(tremoloGain.gain, 0.008, context.currentTime);

  primaryOscillator.connect(gainNode);
  secondaryOscillator.connect(gainNode);
  tremoloOscillator.connect(tremoloGain);
  tremoloGain.connect(gainNode.gain);
  gainNode.connect(context.destination);

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    if (stopTimeoutId !== null) {
      window.clearTimeout(stopTimeoutId);
    }

    try {
      primaryOscillator.stop();
      secondaryOscillator.stop();
      tremoloOscillator.stop();
    } catch {
      // Oscillators may already be stopped during cleanup.
    }

    primaryOscillator.disconnect();
    secondaryOscillator.disconnect();
    tremoloOscillator.disconnect();
    tremoloGain.disconnect();
    gainNode.disconnect();

    if (typeof context.close === 'function') {
      void context.close().catch(() => {});
    }
  };

  if (typeof context.resume === 'function') {
    void context.resume().catch(() => {});
  }

  primaryOscillator.start();
  secondaryOscillator.start();
  tremoloOscillator.start();

  stopTimeoutId = window.setTimeout(cleanup, durationMs);

  return cleanup;
}

export function PowerOnIntro({ onComplete }: PowerOnIntroProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const sequence = useMemo(
    () => (prefersReducedMotion ? REDUCED_SEQUENCE : FULL_SEQUENCE),
    [prefersReducedMotion]
  );
  const durationMs = prefersReducedMotion ? REDUCED_DURATION_MS : FULL_DURATION_MS;
  const [phase, setPhase] = useState<IntroPhase>(sequence[0].phase);

  const phaseLabel = sequence.find((entry) => entry.phase === phase)?.label ?? 'Signal stable.';

  useEffect(() => {
    setPhase(sequence[0].phase);

    const timeoutIds = sequence.slice(1).map((entry) => {
      return window.setTimeout(() => {
        setPhase(entry.phase);
      }, entry.at);
    });

    const completionTimeoutId = window.setTimeout(() => {
      onComplete();
    }, durationMs);

    const stopHum = playStartupHum(durationMs);

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      window.clearTimeout(completionTimeoutId);
      stopHum();
    };
  }, [durationMs, onComplete, sequence]);

  return (
    <main className={`${styles.root} ${styles[phase]}`} aria-label="Power-on intro">
      <div className={styles.flash} aria-hidden="true" />
      <div className={styles.screen}>
        <div className={styles.vignette} aria-hidden="true" />
        <div className={styles.centerLine} aria-hidden="true" />
        <div className={styles.scanField} aria-hidden="true" />
        <div className={styles.glowOrb} aria-hidden="true" />
        <div className={styles.caption}>
          <p className={styles.brand}>Photo Signal</p>
          <p className={styles.status}>{phaseLabel}</p>
        </div>
      </div>
    </main>
  );
}
