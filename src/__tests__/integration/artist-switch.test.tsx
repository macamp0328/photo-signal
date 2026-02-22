/**
 * Integration Test: Artist Audio Switch
 *
 * Covers the close-and-resume recognition UX:
 * - A detected match shows details with an explicit close action.
 * - Closing details resets recognition state and hides details.
 * - The just-closed artist is suppressed briefly (per-concert cooldown), while
 *   a genuinely different artist can still appear immediately.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { setupBrowserMocks } from './setup';
import type { Concert } from '../../types';

// ─── Mock concert data ────────────────────────────────────────────────────────
// Includes two concerts for Artist B (different IDs, same band) to exercise the
// ID-vs-band dismissal bug.

const MOCK_DATA = {
  concerts: [
    {
      id: 1,
      band: 'Artist A',
      venue: 'Venue A',
      date: '2023-01-01T20:00:00-06:00',
      audioFile: '/audio/a1.opus',
      photoHashes: { phash: ['aaaa0000aaaa0000'] },
    },
    {
      id: 2,
      band: 'Artist B',
      venue: 'Venue B1',
      date: '2023-01-02T20:00:00-06:00',
      audioFile: '/audio/b1.opus',
      photoHashes: { phash: ['bbbb0000bbbb0000'] },
    },
    {
      id: 3,
      band: 'Artist B',
      venue: 'Venue B2',
      date: '2023-01-03T20:00:00-06:00',
      audioFile: '/audio/b2.opus',
      photoHashes: { phash: ['cccc0000cccc0000'] },
    },
    {
      id: 4,
      band: 'Artist C',
      venue: 'Venue C',
      date: '2023-01-04T20:00:00-06:00',
      audioFile: '/audio/c1.opus',
      photoHashes: { phash: ['dddd0000dddd0000'] },
    },
  ],
};

const concertA = MOCK_DATA.concerts[0] as Concert;
const concertB1 = MOCK_DATA.concerts[1] as Concert;
const concertB2 = MOCK_DATA.concerts[2] as Concert;

// ─── Mock photo recognition ───────────────────────────────────────────────────
// Uses React useState so that calling setMockRecognizedConcert() triggers a real
// React re-render, exactly as a live recognition result would.

let setMockRecognizedConcert: (concert: Concert | null) => void = () => {};
const mockReset = vi.fn();

vi.mock('../../modules/photo-recognition', async (importOriginal) => {
  const { useState } = await import('react');
  const actual = await importOriginal<typeof import('../../modules/photo-recognition')>();
  return {
    ...actual,
    usePhotoRecognition: () => {
      const [concert, setConcert] = useState<Concert | null>(null);
      setMockRecognizedConcert = setConcert;
      return {
        recognizedConcert: concert,
        reset: mockReset,
        resetTelemetry: vi.fn(),
        debugInfo: null,
        isRecognizing: false,
        frameQuality: null,
        activeGuidance: 'none' as const,
        detectedRectangle: null,
        rectangleConfidence: 0,
      };
    },
  };
});

// ─── Mock Howler with callback-firing play() ──────────────────────────────────
// The default audio mock never fires 'play' events, so isPlaying stays false.
// This mock fires play listeners synchronously so playback state reflects real use.

vi.mock('howler', () => {
  class MockHowl {
    private _listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    private _playing = false;
    private _vol = 1.0;

    constructor(opts: { volume?: number } = {}) {
      this._vol = opts.volume ?? 1.0;
    }

    on(event: string, cb: (...args: unknown[]) => void) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(cb);
      return this;
    }

    off(event?: string) {
      if (event) {
        delete this._listeners[event];
      } else {
        this._listeners = {};
      }
      return this;
    }

    private _emit(event: string, ...args: unknown[]) {
      (this._listeners[event] ?? []).forEach((cb) => cb(...args));
    }

    play() {
      this._playing = true;
      this._emit('play');
      return 1;
    }

    stop() {
      this._playing = false;
      this._emit('stop');
      return this;
    }

    pause() {
      this._playing = false;
      return this;
    }

    fade(_from: number, to: number) {
      this._vol = to;
      return this;
    }

    volume(vol?: number) {
      if (vol !== undefined) {
        this._vol = vol;
        return this;
      }
      return this._vol;
    }

    playing() {
      return this._playing;
    }

    seek() {
      return 0;
    }

    duration() {
      return 30;
    }

    unload() {
      this._playing = false;
      this._listeners = {};
    }

    once() {
      return this;
    }
  }

  return { Howl: MockHowl, Howler: {} };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Activate the camera view and auto-play Artist A so activeConcert is set. */
async function activateAndPlayArtistA() {
  render(<App />);
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', { name: 'Activate camera and begin experience' }));

  // Recognition locks onto Artist A → auto-play fires → isPlaying becomes true
  await act(async () => {
    setMockRecognizedConcert(concertA);
  });

  // Wait until Artist A is playing (primary action switches to "Pause …")
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Artist Audio Switch', () => {
  beforeEach(() => {
    setupBrowserMocks();
    vi.clearAllMocks();

    // Use extended concert data that includes two Artist B entries
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_DATA,
    } as Response);
  });

  it('closing details hides the card and resets recognition state', async () => {
    await activateAndPlayArtistA();
    const user = userEvent.setup();

    expect(screen.getByLabelText('Concert details')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close concert details/i }));

    expect(screen.queryByLabelText('Concert details')).not.toBeInTheDocument();
    expect(mockReset).toHaveBeenCalled();
  });

  it('closing details applies cooldown only to the just-closed concert', async () => {
    await activateAndPlayArtistA();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /close concert details/i }));

    // Recognition detects Artist B concert #1
    await act(async () => {
      setMockRecognizedConcert(concertB1);
    });
    await waitFor(() => {
      expect(screen.getByText('Artist B')).toBeInTheDocument();
    });

    // Close Artist B details to start per-concert cooldown
    await user.click(screen.getByRole('button', { name: /close concert details/i }));

    // Immediate re-detection of the same closed concert is suppressed during cooldown
    await act(async () => {
      setMockRecognizedConcert(concertB1);
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Concert details')).not.toBeInTheDocument();
    });

    // A different concert can still show immediately
    await act(async () => {
      setMockRecognizedConcert(concertB2);
    });
    await waitFor(() => {
      expect(screen.getByText('Venue B2')).toBeInTheDocument();
    });
  });
});
