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
    similarityThreshold: 40,
    recognitionDelay: 3000,
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
      guidanceTracking: {
        shown: {
          'motion-blur': 5,
          glare: 2,
          'poor-lighting': 1,
          'ambiguous-match': 0,
          distance: 0,
          'off-center': 0,
          none: 34,
        },
        duration: {
          'motion-blur': 5000,
          glare: 2000,
          'poor-lighting': 1000,
          'ambiguous-match': 0,
          distance: 0,
          'off-center': 0,
          none: 34000,
        },
        lastShown: {
          'motion-blur': Date.now() - 5000,
          glare: Date.now() - 2000,
          'poor-lighting': Date.now() - 1000,
          'ambiguous-match': 0,
          distance: 0,
          'off-center': 0,
          none: Date.now(),
        },
      },
    },
    hashAlgorithm: 'phash',
  };

  const defaultProps: DebugOverlayProps = {
    recognizedConcert: null,
    isRecognizing: false,
    enabled: true,
    isTestMode: true,
    debugInfo: mockDebugInfo,
    threshold: undefined,
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

      expect(screen.getByText('🐛 Debug Info')).toBeInTheDocument();
    });

    it('should render with live data badge when not in test mode', () => {
      render(<DebugOverlay {...defaultProps} isTestMode={false} />);

      expect(screen.getByText('LIVE DATA')).toBeInTheDocument();
    });
  });

  describe('Threshold Display - Bug Regression Tests', () => {
    it('should display custom threshold when threshold prop is provided', () => {
      render(<DebugOverlay {...defaultProps} threshold={25} />);

      // Custom threshold: distance ≤ 25
      expect(screen.getByText(/Distance ≤ 25/)).toBeInTheDocument();
    });

    it('should display debugInfo threshold when threshold prop is not provided', () => {
      render(<DebugOverlay {...defaultProps} threshold={undefined} />);

      // Should use debugInfo.similarityThreshold which is 40
      expect(screen.getByText(/Distance ≤ 40/)).toBeInTheDocument();
    });

    it('should default to 40 when neither threshold prop nor debugInfo.similarityThreshold is available', () => {
      const debugInfoWithoutThreshold = {
        ...mockDebugInfo,
      };
      // Remove similarityThreshold to test fallback
      delete (debugInfoWithoutThreshold as Partial<RecognitionDebugInfo>).similarityThreshold;

      render(
        <DebugOverlay
          {...defaultProps}
          threshold={undefined}
          debugInfo={debugInfoWithoutThreshold as RecognitionDebugInfo}
        />
      );

      // Should default to 40
      expect(screen.getByText(/Distance ≤ 40/)).toBeInTheDocument();
    });

    it('should prioritize threshold prop over debugInfo.similarityThreshold', () => {
      render(
        <DebugOverlay
          {...defaultProps}
          threshold={30}
          debugInfo={{
            ...mockDebugInfo,
            similarityThreshold: 50, // Different value
          }}
        />
      );

      // Should use threshold prop (30), not debugInfo.similarityThreshold (50)
      expect(screen.getByText(/Distance ≤ 30/)).toBeInTheDocument();
      expect(screen.queryByText(/Distance ≤ 50/)).not.toBeInTheDocument();
    });

    it('should calculate correct similarity percentage from threshold', () => {
      render(<DebugOverlay {...defaultProps} threshold={40} />);

      // Similarity = ((256 - 40) / 256) * 100 = 84.375%
      expect(screen.getByText(/≥ 84% similarity/)).toBeInTheDocument();
    });
  });

  describe('DebugInfo Null Handling - Bug Regression Tests', () => {
    it('should display placeholder values when debugInfo is null', () => {
      render(<DebugOverlay {...defaultProps} debugInfo={null} />);

      // Frame hash should show N/A
      expect(screen.getByText('N/A')).toBeInTheDocument();

      // No metrics section should be displayed when debugInfo is null
      expect(screen.queryByText('Metrics')).not.toBeInTheDocument();

      // No best match section should be displayed
      expect(screen.queryByText('Best Match')).not.toBeInTheDocument();
    });

    it('should display placeholder values when debugInfo is undefined', () => {
      render(<DebugOverlay {...defaultProps} debugInfo={undefined} />);

      // Frame hash should show N/A
      expect(screen.getByText('N/A')).toBeInTheDocument();

      // No metrics section when debugInfo is undefined
      expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
    });

    it('should display actual values when debugInfo is provided', () => {
      render(<DebugOverlay {...defaultProps} debugInfo={mockDebugInfo} />);

      // Frame hash should be truncated and displayed
      expect(screen.getByText(/abcdef...7890/)).toBeInTheDocument();

      // Metrics section should be displayed
      expect(screen.getByText('Metrics')).toBeInTheDocument();
      expect(screen.getByText('Concerts')).toBeInTheDocument();
      expect(screen.getByText('Frames')).toBeInTheDocument();
    });

    it('should handle transition from null to populated debugInfo', () => {
      const { rerender } = render(<DebugOverlay {...defaultProps} debugInfo={null} />);

      // Initially should show placeholders
      expect(screen.getByText('N/A')).toBeInTheDocument();

      // Update with actual debugInfo
      rerender(<DebugOverlay {...defaultProps} debugInfo={mockDebugInfo} />);

      // Should now show actual values
      expect(screen.getByText(/abcdef...7890/)).toBeInTheDocument();
      expect(screen.getByText('Metrics')).toBeInTheDocument();
    });

    it('should handle transition from populated to null debugInfo (after reset)', () => {
      const { rerender } = render(<DebugOverlay {...defaultProps} debugInfo={mockDebugInfo} />);

      // Initially should show actual values
      expect(screen.getByText(/abcdef...7890/)).toBeInTheDocument();

      // Simulate reset by setting debugInfo to null
      rerender(<DebugOverlay {...defaultProps} debugInfo={null} />);

      // Should now show placeholders
      expect(screen.getByText('N/A')).toBeInTheDocument();
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

  describe('Metrics Display', () => {
    it('should display all metrics when debugInfo is provided', () => {
      render(<DebugOverlay {...defaultProps} debugInfo={mockDebugInfo} />);

      expect(screen.getByText('Metrics')).toBeInTheDocument();

      // Frame count
      expect(screen.getByText('Frames')).toBeInTheDocument();

      // Concert count
      expect(screen.getByText('Concerts')).toBeInTheDocument();

      // Check interval
      expect(screen.getByText('Interval')).toBeInTheDocument();

      // Aspect ratio
      expect(screen.getByText('Aspect')).toBeInTheDocument();

      // Frame size
      expect(screen.getByText('Frame Size')).toBeInTheDocument();
    });

    it('should display placeholder dashes when debugInfo is null', () => {
      render(<DebugOverlay {...defaultProps} debugInfo={null} />);

      // Metrics section should not be displayed when debugInfo is null
      expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
    });
  });

  describe('Recognized Concert Display', () => {
    it('should display recognized concert information', () => {
      render(
        <DebugOverlay {...defaultProps} recognizedConcert={mockConcert} debugInfo={mockDebugInfo} />
      );

      expect(screen.getByText('🎵 Recognized')).toBeInTheDocument();
      // Use getAllByText since "Test Band" appears in both Best Match and Recognized sections
      const bandNames = screen.getAllByText('Test Band');
      expect(bandNames.length).toBeGreaterThan(0);
      expect(screen.getByText('Test Venue')).toBeInTheDocument();
      expect(screen.getByText('August 15, 2023 at 8:00 PM CDT')).toBeInTheDocument();
    });

    it('should not display recognized section when concert is null', () => {
      render(<DebugOverlay {...defaultProps} recognizedConcert={null} />);

      expect(screen.queryByText('🎵 Recognized')).not.toBeInTheDocument();
    });

    it('should include time data when recognized concert has a timestamp', () => {
      render(
        <DebugOverlay
          {...defaultProps}
          recognizedConcert={{ ...mockConcert, date: '2023-08-15T21:30:00-05:00' }}
          debugInfo={mockDebugInfo}
        />
      );

      expect(screen.getByText('August 15, 2023 at 9:30 PM CDT')).toBeInTheDocument();
    });
  });

  describe('Frame Hash Display', () => {
    it('should truncate long frame hash correctly', () => {
      const longHash = 'abcdef1234567890abcdef1234567890';
      render(
        <DebugOverlay
          {...defaultProps}
          debugInfo={{
            ...mockDebugInfo,
            lastFrameHash: longHash,
          }}
        />
      );

      // Should show first 6 and last 4 characters: "abcdef...7890"
      expect(screen.getByText(/abcdef...7890/)).toBeInTheDocument();
    });

    it('should display N/A when frame hash is null', () => {
      render(
        <DebugOverlay
          {...defaultProps}
          debugInfo={{
            ...mockDebugInfo,
            lastFrameHash: null,
          }}
        />
      );

      expect(screen.getByText('N/A')).toBeInTheDocument();
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
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should handle rapid enabled/disabled toggling', () => {
      const { rerender } = render(<DebugOverlay {...defaultProps} enabled={true} />);

      expect(screen.getByText('🐛 Debug Info')).toBeInTheDocument();

      rerender(<DebugOverlay {...defaultProps} enabled={false} />);
      expect(screen.getByText('Show overlay')).toBeInTheDocument();

      rerender(<DebugOverlay {...defaultProps} enabled={true} />);
      fireEvent.click(screen.getByText('Show overlay'));
      expect(screen.getByText('🐛 Debug Info')).toBeInTheDocument();
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
});
