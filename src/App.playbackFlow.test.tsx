import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import type { Concert } from './types';
import type {
  GuidanceType,
  RecognitionDebugInfo,
  RecognitionTelemetry,
} from './modules/photo-recognition/types';
import { createEmptyTelemetry } from './modules/photo-recognition/helpers';

const concertOne: Concert = {
  id: 1,
  band: 'Band One',
  venue: 'Venue One',
  date: '2024-01-01T20:00:00-05:00',
  audioFile: '/audio/one.opus',
  imageFile: '/images/one.jpg',
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
  photoHashes: {
    phash: ['0011223344556677'],
  },
};

const mockPlay = vi.fn();
const mockPause = vi.fn();
const mockPreload = vi.fn();
const mockFadeOut = vi.fn();
const mockCrossfade = vi.fn();
const mockSetVolume = vi.fn();

const audioState = {
  isPlaying: false,
  progress: 0,
  playbackError: null as string | null,
};

const recognitionState = {
  recognizedConcert: null as Concert | null,
  switchCandidateConcert: null as Concert | null,
  isRecognizing: false,
  debugInfo: null as RecognitionDebugInfo | null,
  frameQuality: null,
  activeGuidance: 'none' as GuidanceType,
  detectedRectangle: null,
  rectangleConfidence: 0,
};

const mockResetRecognition = vi.fn();
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
  guidanceTracking: {
    shown: {
      'motion-blur': 0,
      glare: 0,
      'poor-lighting': 0,
      'ambiguous-match': 0,
      distance: 0,
      'off-center': 0,
      none: 1,
    },
    duration: {
      'motion-blur': 0,
      glare: 0,
      'poor-lighting': 0,
      'ambiguous-match': 0,
      distance: 0,
      'off-center': 0,
      none: 100,
    },
    lastShown: {
      'motion-blur': 0,
      glare: 0,
      'poor-lighting': 0,
      'ambiguous-match': 0,
      distance: 0,
      'off-center': 0,
      none: Date.now(),
    },
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
  useCustomSettings: () => ({
    getSetting: () => undefined,
    settings: {},
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
  usePhotoRecognition: () => ({
    ...recognitionState,
    reset: mockResetRecognition,
    resetTelemetry: vi.fn(),
  }),
  FrameQualityIndicator: () => null,
  GuidanceMessage: ({ guidanceType }: { guidanceType: GuidanceType }) => (
    <div data-testid="guidance-message">{guidanceType}</div>
  ),
  computeActiveSettings: vi.fn(() => ({})),
  computeAiRecommendations: vi.fn(() => []),
}));

vi.mock('./modules/audio-playback', () => ({
  useAudioPlayback: () => ({
    play: mockPlay,
    pause: mockPause,
    preload: mockPreload,
    fadeOut: mockFadeOut,
    crossfade: mockCrossfade,
    isPlaying: audioState.isPlaying,
    progress: audioState.progress,
    playbackError: audioState.playbackError,
    clearPlaybackError: vi.fn(),
    stop: vi.fn(),
    volume: 0.8,
    setVolume: mockSetVolume,
  }),
}));

describe('App playback flow', () => {
  beforeEach(() => {
    recognitionState.recognizedConcert = null;
    recognitionState.switchCandidateConcert = null;
    recognitionState.isRecognizing = false;
    recognitionState.debugInfo = null;
    recognitionState.frameQuality = null;
    recognitionState.activeGuidance = 'none';
    recognitionState.detectedRectangle = null;
    recognitionState.rectangleConfidence = 0;
    enabledFlags.clear();

    audioState.isPlaying = false;
    audioState.progress = 0;
    audioState.playbackError = null;

    vi.clearAllMocks();
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
    expect(
      screen.getByText('Signal is locked. Playback runs continuously until you pause.')
    ).toBeInTheDocument();
  });

  it('shows prompt-before-switch and crossfades only after confirm', async () => {
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

    expect(
      screen.getByText('Current cut: Band One. Fresh lock found: Band Two.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep current track' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Band Two' })).toBeInTheDocument();

    expect(mockCrossfade).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Switch to Band Two' }));

    expect(mockCrossfade).toHaveBeenCalledWith('/audio/two.opus');
  });

  it('shows ambiguity guidance while a track is already recognized', async () => {
    recognitionState.recognizedConcert = concertOne;
    recognitionState.activeGuidance = 'ambiguous-match';
    audioState.isPlaying = true;

    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    expect(screen.getByTestId('guidance-message')).toHaveTextContent('ambiguous-match');
  });

  it('shows switch prompt from switchCandidateConcert while recognizedConcert remains active', async () => {
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

    recognitionState.switchCandidateConcert = concertTwo;
    recognitionState.activeGuidance = 'ambiguous-match';
    view.rerender(<App />);

    expect(
      screen.getByText('Current cut: Band One. Fresh lock found: Band Two.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Band Two' })).toBeInTheDocument();
  });

  it('keeps same candidate dismissed after keep-current and re-prompts when a different candidate arrives', async () => {
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

    recognitionState.switchCandidateConcert = concertTwo;
    view.rerender(<App />);

    expect(screen.getByRole('button', { name: 'Switch to Band Two' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep current track' }));
    expect(screen.queryByRole('button', { name: 'Switch to Band Two' })).not.toBeInTheDocument();

    recognitionState.activeGuidance = 'ambiguous-match';
    view.rerender(<App />);
    expect(screen.queryByRole('button', { name: 'Switch to Band Two' })).not.toBeInTheDocument();

    recognitionState.switchCandidateConcert = concertThree;
    recognitionState.activeGuidance = 'none';
    view.rerender(<App />);

    expect(screen.getByRole('button', { name: 'Switch to Band Three' })).toBeInTheDocument();
  });

  it('shows a new switch prompt for a different candidate after keep-current dismisses the first', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Keep current track' }));

    recognitionState.activeGuidance = 'none';
    view.rerender(<App />);
    expect(screen.queryByRole('button', { name: 'Switch to Band Two' })).not.toBeInTheDocument();

    recognitionState.recognizedConcert = concertThree;
    view.rerender(<App />);
    expect(screen.getByRole('button', { name: 'Switch to Band Three' })).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Play Track' }));

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
    expect(screen.getByText(/Signal:\s*Playback Fault/i)).toBeInTheDocument();
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
        'Audio failed to load. Check your connection and try again. Check stream access and tap Play to retry.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Signal:\s*Playback Fault/i)).toBeInTheDocument();
  });

  it('shows switch prompt and hides it when user chooses to keep current track', async () => {
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

    expect(screen.getByRole('button', { name: 'Keep current track' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Band Two' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep current track' }));

    expect(screen.queryByRole('button', { name: 'Keep current track' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Switch to Band Two' })).not.toBeInTheDocument();
  });
});
