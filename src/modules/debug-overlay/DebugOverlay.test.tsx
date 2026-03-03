import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebugOverlay } from './DebugOverlay';
import type { DebugOverlayProps } from './types';
import type { Concert } from '../../types';
import type { RecognitionDebugInfo } from '../photo-recognition/types';
import { createEmptyTelemetry } from '../photo-recognition/helpers';

const mockRunTest = vi.fn();
const mockResetTest = vi.fn();

vi.mock('./useAudioTest', () => ({
  useAudioTest: () => ({
    runTest: mockRunTest,
    isTestRunning: false,
    testResult: null,
    resetTest: mockResetTest,
  }),
}));

describe('DebugOverlay', () => {
  const mockConcert: Concert = {
    id: 1,
    band: 'Test Band',
    venue: 'Test Venue',
    date: '2023-08-15T20:00:00-05:00',
    audioFile: '/audio/test.opus',
  };

  const mockDebugInfo: RecognitionDebugInfo = {
    lastFrameHash: 'abcdef1234567890abcdef1234567890',
    bestMatch: {
      concert: mockConcert,
      distance: 10,
      similarity: 96.1,
    },
    secondBestMatch: {
      concert: mockConcert,
      distance: 10,
      similarity: 84.4,
      algorithm: 'phash',
    },
    bestMatchMargin: 7,
    lastCheckTime: Date.now(),
    concertCount: 5,
    frameCount: 42,
    checkInterval: 1000,
    aspectRatio: '3:2',
    frameSize: { width: 640, height: 480 },
    stability: null,
    similarityThreshold: 14,
    recognitionDelay: 200,
    frameQuality: {
      sharpness: 150,
      isSharp: true,
      glarePercentage: 5,
      hasGlare: false,
    },
    telemetry: {
      ...createEmptyTelemetry(),
      totalFrames: 42,
      blurRejections: 5,
      glareRejections: 2,
      lightingRejections: 1,
      qualityFrames: 34,
      successfulRecognitions: 1,
      failedAttempts: 0,
      failureHistory: [],
      failureByCategory: {
        'motion-blur': 5,
        glare: 2,
        'poor-quality': 1,
        'no-match': 0,
        collision: 0,
        unknown: 0,
      },
    },
    hashAlgorithm: 'phash',
  };

  const defaultProps: DebugOverlayProps = {
    recognizedConcert: null,
    isRecognizing: false,
    enabled: true,
    debugInfo: mockDebugInfo,
    onReset: undefined,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockRunTest.mockReset();
    mockResetTest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Visibility', () => {
    it('should render when enabled is true', () => {
      render(<DebugOverlay {...defaultProps} />);

      expect(screen.getByText('Debug')).toBeInTheDocument();
    });

    it('should return null when enabled is false', () => {
      const { container, rerender } = render(<DebugOverlay {...defaultProps} enabled={true} />);

      expect(screen.getByText('Debug')).toBeInTheDocument();

      rerender(<DebugOverlay {...defaultProps} enabled={false} />);
      // Component returns null when disabled
      expect(container.firstChild).toBeNull();
      expect(screen.queryByText('Show overlay')).not.toBeInTheDocument();
    });
  });

  describe('Recognition Status', () => {
    it('should display IDLE status when no activity', () => {
      render(
        <DebugOverlay
          {...defaultProps}
          recognizedConcert={null}
          isRecognizing={false}
          debugInfo={null}
        />
      );

      expect(screen.getByText('Idle')).toBeInTheDocument();
      expect(screen.getByText('⚪')).toBeInTheDocument();
    });

    it('should display CHECKING status when frame hash exists but not recognizing', () => {
      render(
        <DebugOverlay
          {...defaultProps}
          recognizedConcert={null}
          isRecognizing={false}
          debugInfo={mockDebugInfo}
        />
      );

      expect(screen.getByText('Checking')).toBeInTheDocument();
      expect(screen.getByText('🔵')).toBeInTheDocument();
    });

    it('should display MATCHING status when actively recognizing', () => {
      render(
        <DebugOverlay
          {...defaultProps}
          recognizedConcert={null}
          isRecognizing={true}
          debugInfo={mockDebugInfo}
        />
      );

      expect(screen.getByText('Matching')).toBeInTheDocument();
      expect(screen.getByText('🟡')).toBeInTheDocument();
    });

    it('should display RECOGNIZED status when concert is recognized', () => {
      render(
        <DebugOverlay
          {...defaultProps}
          recognizedConcert={mockConcert}
          isRecognizing={false}
          debugInfo={mockDebugInfo}
        />
      );

      expect(screen.getByText('Recognized')).toBeInTheDocument();
      expect(screen.getByText('🟢')).toBeInTheDocument();
    });
  });

  describe('Best Match Display', () => {
    it('should not display best match section when debugInfo is null', () => {
      render(<DebugOverlay {...defaultProps} debugInfo={null} />);

      expect(screen.queryByText('Best Match')).not.toBeInTheDocument();
    });

    it('should not display best match section when bestMatch is null', () => {
      render(
        <DebugOverlay
          {...defaultProps}
          debugInfo={{
            ...mockDebugInfo,
            bestMatch: null,
          }}
        />
      );

      expect(screen.queryByText('Best Match')).not.toBeInTheDocument();
    });

    it('should display best match information when available', () => {
      render(<DebugOverlay {...defaultProps} debugInfo={mockDebugInfo} />);

      expect(screen.getByText('Best Match')).toBeInTheDocument();
      expect(screen.getByText('Distance:')).toBeInTheDocument();
      expect(screen.getByText('Similarity:')).toBeInTheDocument();
    });
  });

  describe('Reset Button', () => {
    it('should display reset button when onReset is provided', () => {
      const onReset = vi.fn();
      render(<DebugOverlay {...defaultProps} onReset={onReset} />);

      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('should not display reset button when onReset is not provided', () => {
      render(<DebugOverlay {...defaultProps} onReset={undefined} />);

      expect(screen.queryByText('Reset')).not.toBeInTheDocument();
    });

    it('should disable reset button when concert is recognized', () => {
      const onReset = vi.fn();
      render(<DebugOverlay {...defaultProps} recognizedConcert={mockConcert} onReset={onReset} />);

      const resetButton = screen.getByText('Reset');
      expect(resetButton).toBeDisabled();
    });

    it('should disable reset button when actively recognizing', () => {
      const onReset = vi.fn();
      render(<DebugOverlay {...defaultProps} isRecognizing={true} onReset={onReset} />);

      const resetButton = screen.getByText('Reset');
      expect(resetButton).toBeDisabled();
    });
  });

  describe('Audio Test Button', () => {
    it('should show Test Song button when testAudioUrl is provided', () => {
      render(<DebugOverlay {...defaultProps} testAudioUrl="https://audio.example.com/song.opus" />);

      expect(screen.getByText('Test Song')).toBeInTheDocument();
    });

    it('should not show Test Song button when testAudioUrl is null', () => {
      render(<DebugOverlay {...defaultProps} testAudioUrl={null} />);

      expect(screen.queryByText('Test Song')).not.toBeInTheDocument();
    });

    it('should not show Test Song button when testAudioUrl is not provided', () => {
      render(<DebugOverlay {...defaultProps} />);

      expect(screen.queryByText('Test Song')).not.toBeInTheDocument();
    });

    it('should call runTest when Test Song button is clicked', () => {
      const url = 'https://audio.example.com/song.opus';
      render(<DebugOverlay {...defaultProps} testAudioUrl={url} />);

      fireEvent.click(screen.getByText('Test Song'));

      expect(mockRunTest).toHaveBeenCalledWith(url);
    });

    it('should show Audio Test label in the section', () => {
      render(<DebugOverlay {...defaultProps} testAudioUrl="https://audio.example.com/song.opus" />);

      expect(screen.getByText('Audio Test')).toBeInTheDocument();
    });
  });

  describe('Force Match Button', () => {
    it('should show Force Match button when onForceMatch is provided', () => {
      const onForceMatch = vi.fn();
      render(<DebugOverlay {...defaultProps} onForceMatch={onForceMatch} />);

      expect(screen.getByLabelText('Force photo match')).toBeInTheDocument();
    });

    it('should not show Force Match button when onForceMatch is not provided', () => {
      render(<DebugOverlay {...defaultProps} />);

      expect(screen.queryByText('Force Match')).not.toBeInTheDocument();
    });

    it('should call onForceMatch when Force Match button is clicked', () => {
      const onForceMatch = vi.fn();
      render(<DebugOverlay {...defaultProps} onForceMatch={onForceMatch} />);

      fireEvent.click(screen.getByLabelText('Force photo match'));

      expect(onForceMatch).toHaveBeenCalledOnce();
    });
  });

  describe('Edge Cases', () => {
    it('should handle all null/undefined fields gracefully', () => {
      const minimalDebugInfo: RecognitionDebugInfo = {
        lastFrameHash: null,
        bestMatch: null,
        secondBestMatch: null,
        bestMatchMargin: null,
        lastCheckTime: 0,
        concertCount: 0,
        frameCount: 0,
        checkInterval: 1000,
        aspectRatio: '3:2',
        frameSize: null,
        stability: null,
        similarityThreshold: 40,
        recognitionDelay: 3000,
        frameQuality: null,
        telemetry: createEmptyTelemetry(),
        hashAlgorithm: 'phash',
      };

      const { container } = render(<DebugOverlay {...defaultProps} debugInfo={minimalDebugInfo} />);

      // Should render without errors
      expect(container).toBeInTheDocument();
    });

    it('should not display best match when debugInfo has no best match', () => {
      render(<DebugOverlay {...defaultProps} debugInfo={null} />);

      expect(screen.queryByText('Best Match')).not.toBeInTheDocument();
    });
  });
});
