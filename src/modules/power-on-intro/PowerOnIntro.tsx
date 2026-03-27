import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { dataService } from '../../services/data-service';
import type { PowerOnIntroProps } from './types';
import styles from './PowerOnIntro.module.css';

type IntroPhase = 'black' | 'ember' | 'raster' | 'drift' | 'lock' | 'handoff';

const FULL_SEQUENCE = [
  { phase: 'black' as const, at: 0 },
  { phase: 'ember' as const, at: 4200 },
  { phase: 'raster' as const, at: 8800 },
  { phase: 'drift' as const, at: 14600 },
  { phase: 'lock' as const, at: 19500 },
  { phase: 'handoff' as const, at: 21800 },
];

const REDUCED_SEQUENCE = [{ phase: 'handoff' as const, at: 0 }];

const FULL_DURATION_MS = 23000;
const REDUCED_DURATION_MS = 1600;
const MIRAGE_PANE_COUNT = 6;

type AudioContextConstructor = typeof AudioContext;

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: AudioContextConstructor;
}

interface AudioParamLike {
  setValueAtTime?: (value: number, startTime: number) => void;
  linearRampToValueAtTime?: (value: number, endTime: number) => void;
  exponentialRampToValueAtTime?: (value: number, endTime: number) => void;
}

interface MiragePaneStyle extends CSSProperties {
  '--pane-angle': string;
  '--pane-delay': string;
  '--pane-drift': string;
  '--pane-flip': string;
  '--pane-scale': string;
}

function extractPhotoUrls(concerts: Awaited<ReturnType<typeof dataService.getConcerts>>): string[] {
  return Array.from(
    new Set(
      concerts
        .map((concert) => concert.photoUrl)
        .filter(
          (photoUrl): photoUrl is string => typeof photoUrl === 'string' && photoUrl.length > 0
        )
    )
  );
}

function buildMirageSet(photoUrls: string[], offset: number, count: number): string[] {
  if (photoUrls.length === 0) {
    return [];
  }

  const paneCount = Math.min(count, photoUrls.length);
  const stride = Math.max(1, Math.floor(photoUrls.length / paneCount));

  return Array.from({ length: paneCount }, (_, index) => {
    const photoIndex = (offset + index * stride + (index % 3) * 2) % photoUrls.length;
    return photoUrls[photoIndex];
  });
}

function getMiragePaneStyle(imageUrl: string, index: number, total: number): MiragePaneStyle {
  const safeTotal = Math.max(total - 1, 1);
  const angle = (360 / Math.max(total, 1)) * index;
  const drift = -14 + (index % 5) * 4;
  const scale = 0.84 + (index % 4) * 0.08;
  const delay = `${(-index * 0.27).toFixed(2)}s`;

  return {
    backgroundImage: `url("${imageUrl}")`,
    '--pane-angle': `${angle.toFixed(2)}deg`,
    '--pane-delay': delay,
    '--pane-drift': `${drift}%`,
    '--pane-flip': index % 2 === 0 ? '1' : '-1',
    '--pane-scale': `${(scale + (index / safeTotal) * 0.04).toFixed(3)}`,
  };
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
  primaryOscillator.frequency.setValueAtTime(43, context.currentTime);
  secondaryOscillator.type = 'triangle';
  secondaryOscillator.frequency.setValueAtTime(86, context.currentTime);
  tremoloOscillator.type = 'sine';
  tremoloOscillator.frequency.setValueAtTime(0.11, context.currentTime);

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
  linearRampToValueAtTime(primaryOscillator.frequency, 58, context.currentTime + 6.4);
  linearRampToValueAtTime(primaryOscillator.frequency, 63, context.currentTime + 15.5);
  linearRampToValueAtTime(primaryOscillator.frequency, 54, context.currentTime + durationMs / 1000);
  linearRampToValueAtTime(secondaryOscillator.frequency, 114, context.currentTime + 7.8);
  linearRampToValueAtTime(
    secondaryOscillator.frequency,
    132,
    context.currentTime + Math.max(durationMs / 1000 - 3.2, 4.2)
  );
  linearRampToValueAtTime(
    tremoloOscillator.frequency,
    0.22,
    context.currentTime + Math.max(durationMs / 1000 - 4.5, 2.2)
  );

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
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const primaryMirageUrls = useMemo(
    () => buildMirageSet(photoUrls, 0, MIRAGE_PANE_COUNT),
    [photoUrls]
  );

  useEffect(() => {
    let isMounted = true;

    void dataService
      .getConcerts()
      .then((concerts) => {
        if (!isMounted) {
          return;
        }

        setPhotoUrls(extractPhotoUrls(concerts));
      })
      .catch(() => {
        if (isMounted) {
          setPhotoUrls([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
    <main
      className={`${styles.root} ${styles[phase]}`}
      aria-label="Power-on intro"
      data-phase={phase}
    >
      <div className={styles.flash} aria-hidden="true" />
      <div className={styles.screen}>
        <div className={styles.vignette} aria-hidden="true" />
        {primaryMirageUrls.length > 0 ? (
          <div className={styles.photoMirage} aria-hidden="true" data-photo-mirage="true">
            <div className={styles.photoLayer}>
              {primaryMirageUrls.map((imageUrl, index) => (
                <div
                  key={`mirage-${imageUrl}-${index}`}
                  className={styles.miragePane}
                  data-mirage-pane="true"
                  style={getMiragePaneStyle(imageUrl, index, primaryMirageUrls.length)}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className={styles.prismField} aria-hidden="true" />
        <div className={styles.signalVeil} aria-hidden="true" />
        <div className={styles.colorBands} aria-hidden="true" />
        <div className={styles.centerLine} aria-hidden="true" />
        <div className={styles.scanField} aria-hidden="true" />
        <div className={styles.haloRing} aria-hidden="true" />
        <div className={styles.glowOrb} aria-hidden="true" />
      </div>
    </main>
  );
}
