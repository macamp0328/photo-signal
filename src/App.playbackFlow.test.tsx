import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
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
const mockFadeOut = vi.fn();
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
  useAudioPlayback: ({ onSongEnd }: { onSongEnd?: () => void } = {}) => {
    capturedOnSongEnd = onSongEnd;
    return {
      play: mockPlay,
      pause: mockPause,
      preload: mockPreload,
      fadeOut: mockFadeOut,
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
        name: 'Activate camera and begin experience',
      })
    );

    return screen.getByRole('button', { name: 'Open matched photo zoom' });
  };

  const openDownloadPromptWithLongPress = async (matchedPhotoButton: HTMLElement) => {
    fireEvent.mouseDown(matchedPhotoButton, { button: 0 });

    await waitFor(() => {
      expect(
        screen.getByRole('dialog', {
          name: 'Download full-size photo',
        })
      ).toBeInTheDocument();
    });

    fireEvent.mouseUp(matchedPhotoButton, { button: 0 });
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
        name: 'Activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');
    expect(mockPreload).toHaveBeenCalledWith('/audio/one.opus');
    expect(screen.getByText('Seen enough? Tap Next pic, please.')).toBeInTheDocument();
  });

  it('starts a multi-song artist on a shuffled first track', async () => {
    randomSpy.mockReturnValue(0);
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one-b.opus');
  });

  it('auto-advances songs on end and reshuffles on cycle wrap', async () => {
    recognitionState.recognizedConcert = concertOne;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
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
        name: 'Activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    view.rerender(<App />);

    await user.click(screen.getByRole('button', { name: /^Pause$/ }));

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
        name: 'Activate camera and begin experience',
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
        name: 'Activate camera and begin experience',
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
        name: 'Activate camera and begin experience',
      })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Now playing controls')).not.toBeInTheDocument();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('shows matched details and renders Switch Artist when a different artist is recognized', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');

    audioState.isPlaying = true;

    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    expect(screen.getByRole('button', { name: 'Next pic, please' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Band Two scanned photograph' })).toBeInTheDocument();
    expect(screen.getByText('Band Two')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch Artist' })).toBeInTheDocument();

    expect(mockCrossfade).not.toHaveBeenCalled();
  });

  it('renders Switch Artist when recognizedConcert changes while song is playing', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;

    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    expect(screen.getByText('Band Two')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch Artist' })).toBeInTheDocument();
  });

  it('switches artists via Switch Artist using crossfade while playback is active', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    await user.click(screen.getByRole('button', { name: 'Switch Artist' }));

    expect(mockCrossfade).toHaveBeenCalledWith('/audio/two.opus');
    expect(mockResetRecognition).toHaveBeenCalled();
  });

  it('closes details and resets recognition when user taps close', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    expect(screen.getByLabelText('Concert details')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next pic, please' }));

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
        name: 'Activate camera and begin experience',
      })
    );

    await user.click(screen.getByRole('button', { name: 'Next pic, please' }));
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
        name: 'Activate camera and begin experience',
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next pic, please' }));
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
        name: 'Activate camera and begin experience',
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
        name: 'Activate camera and begin experience',
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

  it('opens zoom dialog when matched photo is clicked', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhotoButton = await activateExperience(user);

    await user.click(matchedPhotoButton);

    expect(screen.getByRole('dialog', { name: 'Matched photo zoom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('opens long-press download prompt and suppresses zoom for that interaction', async () => {
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

      const matchedPhotoButton = await activateExperience(user);
      await openDownloadPromptWithLongPress(matchedPhotoButton);
      fireEvent.click(matchedPhotoButton);

      expect(screen.queryByRole('dialog', { name: 'Matched photo zoom' })).not.toBeInTheDocument();

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

  it('cancels long-press when pointer moves and allows click-to-zoom', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhotoButton = await activateExperience(user);

    fireEvent.mouseDown(matchedPhotoButton, { button: 0 });
    fireEvent.mouseMove(matchedPhotoButton);
    await new Promise((resolve) => {
      window.setTimeout(resolve, 550);
    });
    fireEvent.mouseUp(matchedPhotoButton, { button: 0 });

    expect(
      screen.queryByRole('dialog', {
        name: 'Download full-size photo',
      })
    ).not.toBeInTheDocument();

    await user.click(matchedPhotoButton);
    expect(screen.getByRole('dialog', { name: 'Matched photo zoom' })).toBeInTheDocument();
  });

  it('closes zoom dialog on Escape and restores focus to matched photo button', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhotoButton = await activateExperience(user);
    await user.click(matchedPhotoButton);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.keyDown(closeButton, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Matched photo zoom' })).not.toBeInTheDocument();
    expect(matchedPhotoButton).toHaveFocus();
  });

  it('closes zoom dialog on backdrop click', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    await user.click(await activateExperience(user));

    const zoomDialog = screen.getByRole('dialog', { name: 'Matched photo zoom' });
    const zoomBackdrop = zoomDialog.parentElement;
    expect(zoomBackdrop).not.toBeNull();

    if (zoomBackdrop) {
      fireEvent.click(zoomBackdrop);
    }

    expect(screen.queryByRole('dialog', { name: 'Matched photo zoom' })).not.toBeInTheDocument();
  });

  it('closes download prompt on Escape and restores focus to matched photo button', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhotoButton = await activateExperience(user);
    await openDownloadPromptWithLongPress(matchedPhotoButton);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.keyDown(cancelButton, { key: 'Escape' });

    expect(
      screen.queryByRole('dialog', {
        name: 'Download full-size photo',
      })
    ).not.toBeInTheDocument();
    expect(matchedPhotoButton).toHaveFocus();
  });

  it('closes download prompt on backdrop click', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    const matchedPhotoButton = await activateExperience(user);
    await openDownloadPromptWithLongPress(matchedPhotoButton);

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

    const matchedPhotoButton = await activateExperience(user);
    await openDownloadPromptWithLongPress(matchedPhotoButton);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const downloadButton = screen.getByRole('button', { name: 'Download' });
    expect(cancelButton).toHaveFocus();

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
        name: 'Activate camera and begin experience',
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
        name: 'Activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');

    audioState.isPlaying = false;
    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    // Record call count before clicking Play button
    const callCountBefore = mockPlay.mock.calls.length;

    await user.click(screen.getByRole('button', { name: /^Play$/ }));

    // Verify Play button click triggered a new play call
    expect(mockPlay.mock.calls.length).toBe(callCountBefore + 1);
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/two.opus');
  });

  it('shows playback error guidance with retry hint', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.playbackError = 'Audio failed to start. Tap Play to retry.';

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    // Should show error message without duplication (already has "Tap Play to retry")
    expect(screen.getByText('Audio failed to start. Tap Play to retry.')).toBeInTheDocument();
    expect(screen.getByText(/^Playback Tantrum$/i)).toBeInTheDocument();
  });

  it('shows playback error with additional guidance when retry hint not included', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.playbackError = 'Audio failed to load. Check your connection and try again.';

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    // Should append retry guidance when error doesn't already include it
    expect(
      screen.getByText(
        'Audio failed to load. Check your connection and try again. Check stream access, then tap Play again.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/^Playback Tantrum$/i)).toBeInTheDocument();
  });

  it('shows Switch Artist in matched-details mode for a different playing artist', async () => {
    recognitionState.recognizedConcert = concertOne;
    recognitionState.debugInfo = createDebugInfo(concertOne);
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    recognitionState.recognizedConcert = concertTwo;
    recognitionState.debugInfo = createDebugInfo(concertTwo, 5);
    view.rerender(<App />);
    view.rerender(<App />);

    expect(screen.getByRole('button', { name: 'Switch Artist' })).toBeInTheDocument();
  });

  it('wraps playlist navigation at boundaries without resetting recognition state', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    await user.click(screen.getByRole('button', { name: 'Play previous track' }));
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/one-b.opus');

    await user.click(screen.getByRole('button', { name: 'Play next track' }));
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
        name: 'Activate camera and begin experience',
      })
    );

    expect(screen.getByRole('img', { name: 'Band One scanned photograph' })).toHaveAttribute(
      'src',
      concertOne.photoUrl
    );

    await user.click(screen.getByRole('button', { name: 'Play next track' }));

    expect(screen.getByRole('img', { name: 'Band One scanned photograph' })).toHaveAttribute(
      'src',
      concertOne.photoUrl
    );
    expect(mockPlay).toHaveBeenLastCalledWith('/audio/one-b.opus');
    expect(mockResetRecognition).not.toHaveBeenCalled();
  });

  it('disables previous/next buttons when playlist has one track', async () => {
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
        name: 'Activate camera and begin experience',
      })
    );

    expect(screen.getByRole('button', { name: 'Play previous track' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Play next track' })).toBeDisabled();
  });

  it('uses crossfade for manual next-track navigation while currently playing', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = false;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    audioState.isPlaying = true;
    view.rerender(<App />);

    await user.click(screen.getByRole('button', { name: 'Play next track' }));
    expect(mockCrossfade).toHaveBeenCalledWith('/audio/one-b.opus');
    expect(mockPlay).not.toHaveBeenLastCalledWith('/audio/one-b.opus');
  });
});
