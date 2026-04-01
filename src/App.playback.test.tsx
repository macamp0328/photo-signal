import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Concert } from './types';
import App from './App';

const mockConcerts: Concert[] = [
  {
    id: 1,
    band: 'Test Band',
    venue: 'Test Venue',
    date: '2024-03-12T20:00:00-05:00',
    audioFile: '/audio/track-one.opus',
    songTitle: 'Track One',
  },
  {
    id: 2,
    band: 'Test Band',
    venue: 'Test Venue',
    date: '2024-03-12T20:00:00-05:00',
    audioFile: '/audio/track-two.opus',
    songTitle: 'Track Two',
  },
  {
    id: 3,
    band: 'Test Band',
    venue: 'Test Venue',
    date: '2024-03-12T20:00:00-05:00',
    audioFile: '/audio/track-three.opus',
    songTitle: 'Track Three',
  },
];

const recognitionState = {
  candidateConcert: null as Concert | null,
  recognizedConcert: null as Concert | null,
  reset: vi.fn(),
  resetTelemetry: vi.fn(),
  forceMatch: vi.fn(),
  debugInfo: null,
  frameQuality: null,
  detectedRectangle: null,
  rectangleConfidence: 0,
  indexLoadFailed: false,
  isRecognizing: false,
};

const audioPlaybackState = {
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  preload: vi.fn(),
  crossfade: vi.fn(),
  isPlaying: false,
  progress: 0,
  playbackError: null as string | null,
  volume: 1,
  setVolume: vi.fn(),
  clearPlaybackError: vi.fn(),
};

vi.mock('./modules/camera-access', () => ({
  useCameraAccess: vi.fn(() => ({
    stream: null,
    error: null,
    hasPermission: true,
    retry: vi.fn(),
  })),
}));

vi.mock('./modules/photo-recognition', () => ({
  usePhotoRecognition: vi.fn(() => recognitionState),
  computeActiveSettings: vi.fn(() => ({})),
  computeAiRecommendations: vi.fn(() => []),
}));

vi.mock('./modules/audio-playback', () => ({
  useAudioPlayback: vi.fn(() => audioPlaybackState),
  useAudioReactiveGlow: vi.fn(),
}));

vi.mock('./modules/camera-view', () => ({
  CameraView: vi.fn(() => <div>Camera View</div>),
}));

vi.mock('./modules/concert-info', () => ({
  InfoDisplay: vi.fn(({ concert }: { concert: Concert }) => <div>{concert.band}</div>),
}));

vi.mock('./modules/gallery-layout', () => ({
  GalleryLayout: vi.fn(
    ({
      onActivate,
      cameraView,
      audioControls,
      aboveCameraSlot,
      belowCameraSlot,
    }: {
      onActivate: () => void;
      cameraView: ReactNode;
      audioControls: ReactNode;
      aboveCameraSlot: ReactNode;
      belowCameraSlot: ReactNode;
    }) => (
      <div>
        <button type="button" onClick={onActivate}>
          Tune in
        </button>
        {cameraView}
        {audioControls}
        {aboveCameraSlot}
        {belowCameraSlot}
      </div>
    )
  ),
}));

vi.mock('./modules/secret-settings', () => ({
  useFeatureFlags: vi.fn(() => ({
    isEnabled: vi.fn(() => false),
  })),
}));

vi.mock('./services/data-service', () => ({
  dataService: {
    getConcerts: vi.fn(async () => mockConcerts),
    getConcertsByBand: vi.fn((band: string) =>
      mockConcerts.filter((concert) => concert.band === band)
    ),
    clearCache: vi.fn(),
  },
}));

vi.mock('./services/recognition-index-service', () => ({
  preloadRecognitionIndex: vi.fn(),
}));

describe('App playback orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    recognitionState.candidateConcert = null;
    recognitionState.recognizedConcert = null;
    recognitionState.isRecognizing = false;
    recognitionState.indexLoadFailed = false;

    audioPlaybackState.isPlaying = false;
    audioPlaybackState.progress = 0;
    audioPlaybackState.playbackError = null;
  });

  it('preloads the candidate concert audio before confirmation', async () => {
    recognitionState.candidateConcert = mockConcerts[0];

    render(<App />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(audioPlaybackState.preload).toHaveBeenCalledWith(mockConcerts[0].audioFile);
    expect(audioPlaybackState.play).not.toHaveBeenCalled();
  });

  it('warms the candidate URL before autoplaying the confirmed match', async () => {
    recognitionState.candidateConcert = mockConcerts[0];

    const { rerender } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Tune in' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(audioPlaybackState.preload).toHaveBeenCalledWith(mockConcerts[0].audioFile);

    recognitionState.candidateConcert = null;
    recognitionState.recognizedConcert = mockConcerts[0];
    rerender(<App />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(audioPlaybackState.play).toHaveBeenCalledWith(mockConcerts[0].audioFile);

    const preloadCallIndex = audioPlaybackState.preload.mock.calls.findIndex(
      ([url]) => url === mockConcerts[0].audioFile
    );
    const playCallIndex = audioPlaybackState.play.mock.calls.findIndex(
      ([url]) => url === mockConcerts[0].audioFile
    );

    expect(preloadCallIndex).toBeGreaterThanOrEqual(0);
    expect(playCallIndex).toBeGreaterThanOrEqual(0);
    expect(audioPlaybackState.preload.mock.invocationCallOrder[preloadCallIndex]).toBeLessThan(
      audioPlaybackState.play.mock.invocationCallOrder[playCallIndex]
    );
  });

  it('preloads the next two tracks after a match starts playback', async () => {
    recognitionState.recognizedConcert = mockConcerts[0];

    const view = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Tune in' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(audioPlaybackState.play).toHaveBeenCalledWith(mockConcerts[0].audioFile);

    audioPlaybackState.isPlaying = true;
    view.rerender(<App />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(audioPlaybackState.preload).toHaveBeenCalledWith(mockConcerts[1].audioFile);
    expect(audioPlaybackState.preload).toHaveBeenCalledWith(mockConcerts[2].audioFile);
  });
});
