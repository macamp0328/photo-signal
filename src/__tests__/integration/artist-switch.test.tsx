/**
 * Integration Test: Artist Audio Switch
 *
 * Covers two bugs in the switch-prompt flow:
 *
 * Bug 1 — Dismissal tracked by concert ID, not band:
 *   Dismissing Artist B concert #2 would be bypassed when Artist B concert #3 was
 *   detected (different ID, same band), causing the switch prompt to re-appear.
 *
 * Bug 2 — Stale recognition after confirming switch:
 *   After the user confirms a switch to Artist B, recognition can briefly still
 *   return Artist A. resetRecognition() must be called on confirm to clear that
 *   stale state before it triggers an immediate back-switch prompt.
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
const concertC = MOCK_DATA.concerts[3] as Concert;

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
// The default photo-to-audio mock never fires 'play' events, so isPlaying stays
// false and every new artist triggers auto-play instead of a switch prompt.
// This mock fires registered 'play' listeners synchronously so isPlaying becomes
// true after the first artist auto-plays, enabling the switch prompt for artist B.

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

  it('dismissing a switch suppresses the prompt for any other song by the same artist', async () => {
    await activateAndPlayArtistA();
    const user = userEvent.setup();

    // Recognition detects Artist B concert #1 → switch prompt appears
    await act(async () => {
      setMockRecognizedConcert(concertB1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Switch to/i })).toBeInTheDocument();
    });

    // User dismisses — they want to keep Artist A
    await user.click(screen.getByRole('button', { name: /Keep current/i }));

    // Recognition now sees Artist B concert #2 (same band, different ID)
    await act(async () => {
      setMockRecognizedConcert(concertB2);
    });

    // The switch prompt must NOT re-appear: dismissal covers the whole artist band
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Switch to/i })).not.toBeInTheDocument();
    });
  });

  it('dismissal is cleared when a genuinely different artist is recognized', async () => {
    await activateAndPlayArtistA();
    const user = userEvent.setup();

    // Recognition detects Artist B → switch prompt appears
    await act(async () => {
      setMockRecognizedConcert(concertB1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Switch to/i })).toBeInTheDocument();
    });

    // User dismisses Artist B
    await user.click(screen.getByRole('button', { name: /Keep current/i }));

    // Recognition now locks onto Artist C — a genuinely different artist
    await act(async () => {
      setMockRecognizedConcert(concertC);
    });

    // Switch prompt should appear for Artist C (dismissal for Artist B is cleared)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Switch to/i })).toBeInTheDocument();
    });
  });

  it('confirming a switch calls resetRecognition to clear stale recognition state', async () => {
    await activateAndPlayArtistA();
    const user = userEvent.setup();

    // Recognition detects Artist B → switch prompt appears
    await act(async () => {
      setMockRecognizedConcert(concertB1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Switch to/i })).toBeInTheDocument();
    });

    // User confirms the switch
    await user.click(screen.getByRole('button', { name: /Switch to/i }));

    // resetRecognition() must be called to flush stale Artist A frames
    expect(mockReset).toHaveBeenCalled();
  });
});
