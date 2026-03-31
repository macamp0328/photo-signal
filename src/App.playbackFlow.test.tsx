import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { useAudioReactiveGlow } from './modules/audio-playback';
import type { Concert } from './types';
import { dataService } from './services/data-service';
import type { RecognitionDebugInfo, RecognitionTelemetry } from './modules/photo-recognition/types';
import { createEmptyTelemetry } from './modules/photo-recognition/helpers';

const concertOne: Concert = {
  id: 1,
  band: 'Band One',
  venue: 'Venue One',
  date: '2024-01-01T20:00:00-05:00',
  audioFile: '/audio/one.opus',
  imageFile: '/images/one.jpg',
  photoUrl: 'https://photo-cdn.example.com/prod/photos/one.jpg',
  photoHashes: {
    phash: ['0123456789abcdef'],
  },
};

const concertTwo: Concert = {
  id: 2,
  band: 'Band Two',
  venue: 'Venue Two',
  date: '2024-02-02T20:00:00-05:00',
  audioFile: '/audio/two.opus',
  imageFile: '/images/two.jpg',
  photoUrl: 'https://photo-cdn.example.com/prod/photos/two.jpg',
  photoHashes: {
    phash: ['fedcba9876543210'],
  },
};

const concertThree: Concert = {
  id: 3,
  band: 'Band Three',
  venue: 'Venue Three',
  date: '2024-03-03T20:00:00-05:00',
  audioFile: '/audio/three.opus',
  imageFile: '/images/three.jpg',
  photoUrl: 'https://photo-cdn.example.com/prod/photos/three.jpg',
  photoHashes: {
    phash: ['0011223344556677'],
  },
};

const mockPlay = vi.fn();
const mockPause = vi.fn();
const mockPreload = vi.fn();
const mockCrossfade = vi.fn();
const mockStop = vi.fn();
const mockSetVolume = vi.fn();
const mockClearPlaybackError = vi.fn();
let capturedOnSongEnd: (() => void) | undefined;
let randomSpy: ReturnType<typeof vi.spyOn>;

const audioState = {
  isPlaying: false,
  progress: 0,
  playbackError: null as string | null,
};

const recognitionState = {
  recognizedConcert: null as Concert | null,
  isRecognizing: false,
  debugInfo: null as RecognitionDebugInfo | null,
  frameQuality: null,
  detectedRectangle: null,
  rectangleConfidence: 0,
};

const mockResetRecognition = vi.fn();
const mockUsePhotoRecognition = vi.fn();
const enabledFlags = new Set<string>();

const createDebugTelemetry = (): RecognitionTelemetry => ({
  ...createEmptyTelemetry(),
  totalFrames: 1,
  blurRejections: 0,
  glareRejections: 0,
  lightingRejections: 0,
  qualityFrames: 1,
  successfulRecognitions: 1,
  failedAttempts: 0,
  failureHistory: [],
  failureByCategory: {
    'motion-blur': 0,
    glare: 0,
    'poor-quality': 0,
    'no-match': 0,
    collision: 0,
    unknown: 0,
  },
});

const createDebugInfo = (concert: Concert, margin = 6): RecognitionDebugInfo => ({
  lastFrameHash: 'abcdef1234567890',
  bestMatch: {
    concert,
    distance: 6,
    similarity: 96.25,
    algorithm: 'phash',
  },
  secondBestMatch: null,
  bestMatchMargin: margin,
  lastCheckTime: Date.now(),
  concertCount: 2,
  frameCount: 10,
  checkInterval: 250,
  aspectRatio: '3:2',
  frameSize: { width: 640, height: 480 },
  stability: null,
  similarityThreshold: 12,
  recognitionDelay: 1000,
  frameQuality: null,
  telemetry: createDebugTelemetry(),
  hashAlgorithm: 'phash',
});

vi.mock('./modules/secret-settings', () => ({
  useFeatureFlags: () => ({
    isEnabled: (flag: string) => enabledFlags.has(flag),
  }),
  useTripleTap: () => undefined,
}));

vi.mock('./modules/camera-access', () => ({
  useCameraAccess: ({ autoStart }: { autoStart: boolean }) => ({
    stream: autoStart ? new MediaStream() : null,
    error: null,
    hasPermission: true,
    retry: vi.fn(),
  }),
}));

vi.mock('./modules/motion-detection', () => ({
  useMotionDetection: () => ({
    isMoving: false,
  }),
}));

vi.mock('./modules/photo-recognition', () => ({
  usePhotoRecognition: (...args: unknown[]) =>
    mockUsePhotoRecognition(...args) ?? {
      ...recognitionState,
      reset: mockResetRecognition,
      resetTelemetry: vi.fn(),
    },
  computeActiveSettings: vi.fn(() => ({})),
  computeAiRecommendations: vi.fn(() => []),
}));

vi.mock('./modules/audio-playback', () => ({
  useAudioReactiveGlow: vi.fn(),
  useAudioPlayback: ({ onSongEnd }: { onSongEnd?: () => void } = {}) => {
    capturedOnSongEnd = onSongEnd;
    return {
      play: mockPlay,
      pause: mockPause,
      preload: mockPreload,
      crossfade: mockCrossfade,
      isPlaying: audioState.isPlaying,
      progress: audioState.progress,
      playbackError: audioState.playbackError,
      clearPlaybackError: mockClearPlaybackError,
      stop: mockStop,
      volume: 0.8,
      setVolume: mockSetVolume,
    };
  },
}));

describe('App playback flow', () => {
  const sameBandTrackTwo: Concert = {
    ...concertOne,
    id: 101,
    songTitle: 'Band One Track Two',
    audioFile: '/audio/one-b.opus',
  };

  beforeEach(() => {
    mockUsePhotoRecognition.mockImplementation(() => ({
      ...recognitionState,
      reset: mockResetRecognition,
      resetTelemetry: vi.fn(),
    }));
    recognitionState.recognizedConcert = null;
    recognitionState.isRecognizing = false;
    recognitionState.debugInfo = null;
    recognitionState.frameQuality = null;
    recognitionState.detectedRectangle = null;
    recognitionState.rectangleConfidence = 0;
    enabledFlags.clear();

    audioState.isPlaying = false;
    audioState.progress = 0;
    audioState.playbackError = null;
    capturedOnSongEnd = undefined;
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    vi.spyOn(dataService, 'getConcerts').mockResolvedValue([
      concertOne,
      sameBandTrackTwo,
      concertTwo,
      concertThree,
    ]);
    vi.spyOn(dataService, 'getConcertsByBand').mockImplementation((band: string) => {
      if (band === concertOne.band) {
        return [concertOne, sameBandTrackTwo];
      }
      if (band === concertTwo.band) {
        return [concertTwo];
      }
      if (band === concertThree.band) {
        return [concertThree];
      }
      return [];
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const activateExperience = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    return screen.getByRole('img', { name: /scanned photograph/i });
  };

  const openDownloadPromptWithLongPress = async (matchedPhoto: HTMLElement) => {
    fireEvent.mouseDown(matchedPhoto, { button: 0 });

    await waitFor(() => {
      expect(
        screen.getByRole('dialog', {
          name: 'Download full-size photo',
        })
      ).toBeInTheDocument();
    });

    fireEvent.mouseUp(matchedPhoto, { button: 0 });
  };

  it('passes telemetry-aligned recognition defaults', () => {
    render(<App />);

    expect(mockUsePhotoRecognition).toHaveBeenCalled();

    const options = mockUsePhotoRecognition.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined;
    expect(options).toBeDefined();
    expect(options?.similarityThreshold).toBe(18);
    expect(options?.matchMarginThreshold).toBe(5);
    expect(options?.sharpnessThreshold).toBe(85);
    expect(options?.recognitionDelay).toBe(180);
    expect(options?.continuousRecognition).toBe(true);
  });

  it('auto-plays first recognized concert after activation', async () => {
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');
    expect(mockPreload).toHaveBeenCalledWith('/audio/one.opus');
  });

  it('always plays the recognized concert first regardless of shuffle order', async () => {
    randomSpy.mockReturnValue(0);
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');
  });

  it('auto-advances songs on end and reshuffles on cycle wrap', async () => {
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(capturedOnSongEnd).toBeDefined();
    mockPlay.mockClear();

    capturedOnSongEnd?.();
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/one-b.opus');

    randomSpy.mockReturnValueOnce(0);
    capturedOnSongEnd?.();
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/one-b.opus');
  });

  it('does not auto-advance on song end when user paused playback', async () => {
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    view.rerender(<App />);

    await user.click(screen.getByRole('button', { name: /^Pause / }));

    mockPlay.mockClear();
    capturedOnSongEnd?.();

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('does not auto-advance on song end for single-track artists', async () => {
    recognitionState.recognizedConcert = concertTwo;
    vi.spyOn(dataService, 'getConcertsByBand').mockImplementation((band: string) => {
      if (band === concertTwo.band) {
        return [concertTwo];
      }
      return [];
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    mockPlay.mockClear();
    capturedOnSongEnd?.();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('stops playback and exits active mode when app is hidden', async () => {
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    fireEvent(document, new Event('visibilitychange'));

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Now playing controls')).not.toBeInTheDocument();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('shows matched photo and details when a different artist is recognized', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');

    audioState.isPlaying = true;

    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    expect(
      screen.getByRole('button', { name: 'Close concert view and scan a new photo' })
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Band Two scanned photograph' })).toBeInTheDocument();
    // Band Two now appears in both the concert overlay and the signal strip (audio switched)
    expect(screen.getAllByText('Band Two')).toHaveLength(2);

    expect(mockCrossfade).toHaveBeenCalledWith('/audio/two.opus');
  });

  it('shows matched photo for newly recognized concert while another song is playing', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;

    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    // Band Two now appears in both the concert overlay and the signal strip (audio switched)
    expect(screen.getAllByText('Band Two')).toHaveLength(2);
  });

  it('crossfades to new artist when recognized while playback is active', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    expect(mockCrossfade).toHaveBeenCalledWith('/audio/two.opus');
  });

  it('closes details and resets recognition when user taps close', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(screen.getByLabelText('Concert details')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Close concert view and scan a new photo' })
    );

    expect(screen.queryByLabelText('Concert details')).not.toBeInTheDocument();
    expect(mockResetRecognition).toHaveBeenCalled();
  });

  it('suppresses immediate re-open for the same concert after closing details', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    await user.click(
      screen.getByRole('button', { name: 'Close concert view and scan a new photo' })
    );
    expect(screen.queryByLabelText('Concert details')).not.toBeInTheDocument();

    recognitionState.recognizedConcert = concertOne;
    view.rerender(<App />);

    expect(screen.queryByLabelText('Concert details')).not.toBeInTheDocument();
  });

  it('allows same concert details to reopen after cooldown expires', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const view = render(<App />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Close concert view and scan a new photo' })
    );
    expect(screen.queryByLabelText('Concert details')).not.toBeInTheDocument();

    recognitionState.recognizedConcert = concertOne;
    view.rerender(<App />);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 2100);
    });
    view.rerender(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText('Concert details')).toBeInTheDocument();
    });
  });

  it('shows static placeholder when matched photo fails to load', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    const scannedPhoto = screen.getByRole('img', { name: 'Band One scanned photograph' });
    fireEvent.error(scannedPhoto);

    expect(screen.getByText('Photo unavailable')).toBeInTheDocument();
  });

  it('recovers from photo load failure when next matched concert has a different photo URL', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    const firstScannedPhoto = screen.getByRole('img', { name: 'Band One scanned photograph' });
    fireEvent.error(firstScannedPhoto);
    expect(screen.getByText('Photo unavailable')).toBeInTheDocument();

    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    expect(screen.getByRole('img', { name: 'Band Two scanned photograph' })).toBeInTheDocument();
    expect(screen.queryByText('Photo unavailable')).not.toBeInTheDocument();
  });

  it('does not open a dialog when matched photo is clicked', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhoto = await activateExperience(user);

    await user.click(matchedPhoto);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens long-press download prompt and downloads the matched photo', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const createObjectUrlMock = vi.fn(() => 'blob:matched-photo-download');
    const revokeObjectUrlMock = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    try {
      render(<App />);

      const matchedPhoto = await activateExperience(user);
      await openDownloadPromptWithLongPress(matchedPhoto);

      await user.click(screen.getByRole('button', { name: 'Download' }));
      await waitFor(() => {
        expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      });
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);
      });
    } finally {
      anchorClickSpy.mockRestore();
    }
  });

  it('cancels long-press when pointer moves and leaves the photo static on click', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhoto = await activateExperience(user);

    fireEvent.mouseDown(matchedPhoto, { button: 0 });
    fireEvent.mouseMove(matchedPhoto);
    await new Promise((resolve) => {
      window.setTimeout(resolve, 550);
    });
    fireEvent.mouseUp(matchedPhoto, { button: 0 });

    expect(
      screen.queryByRole('dialog', {
        name: 'Download full-size photo',
      })
    ).not.toBeInTheDocument();

    await user.click(matchedPhoto);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes download prompt on Escape', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhoto = await activateExperience(user);
    await openDownloadPromptWithLongPress(matchedPhoto);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.keyDown(cancelButton, { key: 'Escape' });

    expect(
      screen.queryByRole('dialog', {
        name: 'Download full-size photo',
      })
    ).not.toBeInTheDocument();

    const scanAnotherButton = screen.getByRole('button', {
      name: /close concert view and scan a new photo/i,
    });
    expect(scanAnotherButton).toHaveFocus();
  });

  it('closes download prompt on backdrop click', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhoto = await activateExperience(user);
    await openDownloadPromptWithLongPress(matchedPhoto);

    const downloadDialog = screen.getByRole('dialog', { name: 'Download full-size photo' });
    const downloadBackdrop = downloadDialog.parentElement;
    expect(downloadBackdrop).not.toBeNull();

    if (downloadBackdrop) {
      fireEvent.click(downloadBackdrop);
    }

    expect(
      screen.queryByRole('dialog', {
        name: 'Download full-size photo',
      })
    ).not.toBeInTheDocument();
  });

  it('traps Tab focus inside download prompt', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhoto = await activateExperience(user);
    await openDownloadPromptWithLongPress(matchedPhoto);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const downloadButton = screen.getByRole('button', { name: 'Download' });
    await waitFor(() => {
      expect(cancelButton).toHaveFocus();
    });

    fireEvent.keyDown(cancelButton, { key: 'Tab', shiftKey: true });
    expect(downloadButton).toHaveFocus();

    fireEvent.keyDown(downloadButton, { key: 'Tab' });
    expect(cancelButton).toHaveFocus();
  });

  it('auto-plays a newly recognized match when no music is currently playing', async () => {
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');

    audioState.isPlaying = false;
    recognitionState.recognizedConcert = null;
    view.rerender(<App />);

    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    expect(mockPlay).toHaveBeenCalledWith('/audio/two.opus');
  });

  it('plays the newly recognized track when paused and user taps Play', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');

    audioState.isPlaying = false;
    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    // Record call count before clicking Play button
    const callCountBefore = mockPlay.mock.calls.length;

    await user.click(screen.getByRole('button', { name: /^Play / }));

    // Verify Play button click triggered a new play call
    expect(mockPlay.mock.calls.length).toBe(callCountBefore + 1);
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/two.opus');
  });

  it('shows paused status only after the user explicitly pauses playback', async () => {
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    view.rerender(<App />);

    await user.click(screen.getByRole('button', { name: /^Pause / }));

    audioState.isPlaying = false;
    view.rerender(<App />);

    expect(screen.getByRole('button', { name: /^Play / })).toBeInTheDocument();
  });

  it('resumes the selected same-artist track instead of jumping back to the playlist start', async () => {
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    await user.click(screen.getByRole('button', { name: 'Next track' }));
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/one-b.opus');

    recognitionState.recognizedConcert = sameBandTrackTwo;
    audioState.isPlaying = true;
    view.rerender(<App />);

    await user.click(screen.getByRole('button', { name: /^Pause / }));

    audioState.isPlaying = false;
    view.rerender(<App />);

    const playCallCount = mockPlay.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /^Play / }));

    expect(mockPlay.mock.calls.length).toBe(playCallCount + 1);
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/one-b.opus');
  });

  it('does not crash when a playback error occurs', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.playbackError = 'Audio failed to start. Tap Play to retry.';

    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    // App should still render normally; error UI was removed in the signal strip redesign
    expect(
      container.querySelector('section[aria-label="Now playing controls"]')
    ).toBeInTheDocument();
  });

  it('shows matched photo for a different recognized artist while another is playing', async () => {
    recognitionState.recognizedConcert = concertOne;
    recognitionState.debugInfo = createDebugInfo(concertOne);
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    recognitionState.recognizedConcert = concertTwo;
    recognitionState.debugInfo = createDebugInfo(concertTwo, 5);
    view.rerender(<App />);
    view.rerender(<App />);

    // Band Two now appears in both the concert overlay and the signal strip (audio switched)
    const bandTwoOccurrences = screen.getAllByText('Band Two');
    expect(bandTwoOccurrences).toHaveLength(2);
  });

  it('navigates playlist with next track without resetting recognition state', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    await user.click(screen.getByRole('button', { name: 'Next track' }));
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/one-b.opus');

    await user.click(screen.getByRole('button', { name: 'Next track' }));
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/one.opus');

    expect(mockResetRecognition).not.toHaveBeenCalled();
  });

  it('keeps the recognized photo displayed when navigating tracks within the same artist', async () => {
    const sameBandDifferentPhotoTrack: Concert = {
      ...sameBandTrackTwo,
      photoUrl: 'https://photo-cdn.example.com/prod/photos/one-alt.jpg',
      imageFile: '/images/one-alt.jpg',
    };

    vi.spyOn(dataService, 'getConcertsByBand').mockImplementation((band: string) => {
      if (band === concertOne.band) {
        return [concertOne, sameBandDifferentPhotoTrack];
      }
      return [];
    });

    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(screen.getByRole('img', { name: 'Band One scanned photograph' })).toHaveAttribute(
      'src',
      concertOne.photoUrl
    );

    await user.click(screen.getByRole('button', { name: 'Next track' }));

    expect(screen.getByRole('img', { name: 'Band One scanned photograph' })).toHaveAttribute(
      'src',
      concertOne.photoUrl
    );
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/one-b.opus');
    expect(mockResetRecognition).not.toHaveBeenCalled();
  });

  it('hides next button when playlist has one track', async () => {
    vi.spyOn(dataService, 'getConcertsByBand').mockImplementation((band: string) => {
      if (band === concertOne.band) {
        return [concertOne];
      }
      return [];
    });

    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(screen.queryByRole('button', { name: 'Next track' })).not.toBeInTheDocument();
  });

  it('uses crossfade for manual next-track navigation while currently playing', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    view.rerender(<App />);

    await user.click(screen.getByRole('button', { name: 'Next track' }));
    expect(mockCrossfade).toHaveBeenCalledWith('/audio/one-b.opus');
    expect(mockPlay).not.toHaveBeenLastCalledWith('/audio/one-b.opus');
  });

  it('auto-plays new artist via crossfade when scanned while another artist is playing', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    expect(mockCrossfade).toHaveBeenCalledWith('/audio/two.opus');
    expect(mockPlay).not.toHaveBeenCalledWith('/audio/two.opus');
  });

  it('does not restart when the same exact concert is re-scanned after the info panel closes', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');

    audioState.isPlaying = true;
    view.rerender(<App />);

    // Simulate closing the info panel (resets recognition, clears previousAutoplayIdRef)
    await user.click(
      screen.getByRole('button', { name: 'Close concert view and scan a new photo' })
    );
    recognitionState.recognizedConcert = null;
    view.rerender(<App />);

    // Re-scan the same photo
    mockPlay.mockClear();
    mockCrossfade.mockClear();
    recognitionState.recognizedConcert = concertOne;
    view.rerender(<App />);

    expect(mockPlay).not.toHaveBeenCalled();
    expect(mockCrossfade).not.toHaveBeenCalled();
  });

  it('advances to a different track when same-artist different-photo is scanned while playing', async () => {
    // Band One has two tracks: concertOne (/audio/one.opus) and sameBandTrackTwo (/audio/one-b.opus)
    // Math.random = 0.99 → playlist order [concertOne, sameBandTrackTwo], starts on concertOne
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');

    // Now playing concertOne; scan a different photo of the same artist
    audioState.isPlaying = true;
    recognitionState.recognizedConcert = sameBandTrackTwo;
    view.rerender(<App />);

    // Should advance to the next track via crossfade, not restart concertOne
    expect(mockCrossfade).toHaveBeenCalledWith('/audio/one-b.opus');
  });

  it('keeps playing when same artist has only one track and a photo of that band is scanned again', async () => {
    vi.spyOn(dataService, 'getConcertsByBand').mockImplementation((band: string) => {
      if (band === concertTwo.band) {
        return [concertTwo];
      }
      return [];
    });

    const concertTwoAlt: Concert = {
      ...concertTwo,
      id: 999,
      photoHashes: { phash: ['aabbccddeeff0011'] },
    };

    recognitionState.recognizedConcert = concertTwo;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Tune in — activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/two.opus');

    audioState.isPlaying = true;
    mockPlay.mockClear();
    mockCrossfade.mockClear();

    // Scan a different photo that is also by the same single-track artist
    recognitionState.recognizedConcert = concertTwoAlt;
    view.rerender(<App />);

    // Only one track — should not crossfade or play anything new
    expect(mockCrossfade).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('sets data-exif-visual attribute when a concert with EXIF is matched and flag is enabled', async () => {
    const concertWithExif: typeof concertOne = {
      ...concertOne,
      iso: '1600',
      aperture: 'f/2.8',
      shutterSpeed: '1/60',
    };

    recognitionState.recognizedConcert = concertWithExif;
    enabledFlags.add('exif-visual-character');

    render(<App />);

    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-exif-visual')).toBe(true);
    });
  });

  it('removes data-exif-visual attribute when recognition is cleared', async () => {
    const concertWithExif: typeof concertOne = {
      ...concertOne,
      iso: '800',
      aperture: 'f/1.8',
      shutterSpeed: '1/125',
    };

    recognitionState.recognizedConcert = concertWithExif;
    enabledFlags.add('exif-visual-character');

    const { rerender } = render(<App />);

    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-exif-visual')).toBe(true);
    });

    // Clear the recognition (simulate losing the photo match)
    recognitionState.recognizedConcert = null;
    rerender(<App />);

    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-exif-visual')).toBe(false);
    });
  });

  it('does not set data-exif-visual when exif-visual-character flag is disabled', async () => {
    const concertWithExif: typeof concertOne = {
      ...concertOne,
      iso: '1600',
      aperture: 'f/2.8',
      shutterSpeed: '1/60',
    };
    recognitionState.recognizedConcert = concertWithExif;
    // 'exif-visual-character' intentionally NOT added to enabledFlags

    // Pre-set the attribute so the assertion fails if resetExifVisualCharacter() never runs
    document.documentElement.setAttribute('data-exif-visual', '');

    render(<App />);

    await act(async () => {});
    expect(document.documentElement.hasAttribute('data-exif-visual')).toBe(false);
  });

  it('calls useAudioReactiveGlow with isEnabled=false when audio-reactive-glow flag is disabled', () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = true;
    // 'audio-reactive-glow' intentionally NOT in enabledFlags

    render(<App />);

    const mockGlow = vi.mocked(useAudioReactiveGlow);
    expect(mockGlow).toHaveBeenCalled();
    // Every call should have isEnabled=false when the flag is absent
    const allCalls = mockGlow.mock.calls;
    expect(allCalls.every(([, isEnabled]) => isEnabled === false)).toBe(true);
  });

  it('calls useAudioReactiveGlow with isEnabled=true when audio-reactive-glow flag is enabled', () => {
    enabledFlags.add('audio-reactive-glow');
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = true;

    render(<App />);

    const mockGlow = vi.mocked(useAudioReactiveGlow);
    expect(mockGlow).toHaveBeenCalled();
    // At least one call should have isEnabled=true
    const allCalls = mockGlow.mock.calls;
    expect(allCalls.some(([, isEnabled]) => isEnabled === true)).toBe(true);
  });

  it('sets --crt-opacity when song-progress-scanlines flag is enabled, playing, and matched', () => {
    enabledFlags.add('song-progress-scanlines');
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = true;
    audioState.progress = 0.5;

    render(<App />);

    // Math.pow(0.5, 2.5) * 0.75 ≈ 0.133
    expect(document.documentElement.style.getPropertyValue('--crt-opacity')).toBe('0.133');
  });

  it('does not set --crt-opacity when song-progress-scanlines flag is disabled', () => {
    // flag intentionally absent
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = true;
    audioState.progress = 0.8;

    render(<App />);

    expect(document.documentElement.style.getPropertyValue('--crt-opacity')).toBe('');
  });

  it('does not set --crt-opacity when not playing', () => {
    enabledFlags.add('song-progress-scanlines');
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;
    audioState.progress = 0.8;

    render(<App />);

    expect(document.documentElement.style.getPropertyValue('--crt-opacity')).toBe('');
  });

  it('does not set --crt-opacity when recognition is not matched (guards against dead-signal suppression)', () => {
    enabledFlags.add('song-progress-scanlines');
    recognitionState.recognizedConcert = null; // unmatched — activeConcert may still be set from prior play
    audioState.isPlaying = true;
    audioState.progress = 0.9;

    render(<App />);

    expect(document.documentElement.style.getPropertyValue('--crt-opacity')).toBe('');
  });
});
