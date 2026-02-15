import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import type { Concert } from './types';

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

const mockPlay = vi.fn();
const mockPause = vi.fn();
const mockPreload = vi.fn();
const mockFadeOut = vi.fn();
const mockCrossfade = vi.fn();
const mockSetVolume = vi.fn();

const audioState = {
  isPlaying: false,
  progress: 0,
};

const recognitionState = {
  recognizedConcert: null as Concert | null,
  isRecognizing: false,
  debugInfo: null,
  frameQuality: null,
  activeGuidance: 'none' as const,
  detectedRectangle: null,
  rectangleConfidence: 0,
};

const mockResetRecognition = vi.fn();

vi.mock('./modules/secret-settings', () => ({
  useFeatureFlags: () => ({
    isEnabled: () => false,
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
  }),
  FrameQualityIndicator: () => null,
  GuidanceMessage: () => null,
  TelemetryExport: () => null,
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
    stop: vi.fn(),
    volume: 0.8,
    setVolume: mockSetVolume,
  }),
}));

describe('App playback flow', () => {
  beforeEach(() => {
    recognitionState.recognizedConcert = null;
    recognitionState.isRecognizing = false;
    recognitionState.debugInfo = null;
    recognitionState.frameQuality = null;
    recognitionState.activeGuidance = 'none';
    recognitionState.detectedRectangle = null;
    recognitionState.rectangleConfidence = 0;

    audioState.isPlaying = false;
    audioState.progress = 0;

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
      screen.getByText('Song started automatically. Music keeps playing until you pause.')
    ).toBeInTheDocument();
  });

  it('shows prompt-before-switch and crossfades only after confirm', async () => {
    recognitionState.recognizedConcert = concertOne;
    audioState.isPlaying = true;

    const user = userEvent.setup();
    const view = render(<App />);

    await user.click(
      screen.getByRole('button', {
        name: 'Activate camera and begin experience',
      })
    );

    expect(mockPlay).toHaveBeenCalledWith('/audio/one.opus');

    recognitionState.recognizedConcert = concertTwo;
    view.rerender(<App />);

    expect(screen.getByText('Now playing Band One. Switch to Band Two?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep current track' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Band Two' })).toBeInTheDocument();

    expect(mockCrossfade).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Switch to Band Two' }));

    expect(mockCrossfade).toHaveBeenCalledWith('/audio/two.opus');
  });
});
