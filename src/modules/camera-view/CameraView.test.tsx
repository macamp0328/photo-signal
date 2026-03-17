import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CameraView } from './CameraView';

/**
 * CameraView Component Tests
 *
 * Tests validate the module contract defined in README.md:
 * - Display video stream in viewport
 * - Show instructions to user
 * - Display permission errors
 */
describe('CameraView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error State (Permission Denied)', () => {
    it('should render error message when hasPermission is false', () => {
      render(
        <CameraView stream={null} error="Camera access denied by user" hasPermission={false} />
      );

      expect(screen.getByText('Camera blocked')).toBeInTheDocument();
      expect(
        screen.getByText('Camera access is off. Let me in to keep scanning.')
      ).toBeInTheDocument();
    });

    it('should not render video element when hasPermission is false', () => {
      const { container } = render(
        <CameraView stream={null} error="Camera access denied" hasPermission={false} />
      );

      const video = container.querySelector('video');
      expect(video).not.toBeInTheDocument();
    });

    it('should render retry button when onRetry callback is provided', () => {
      const mockRetry = vi.fn();

      render(
        <CameraView
          stream={null}
          error="Camera access denied"
          hasPermission={false}
          onRetry={mockRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /let me in/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockRetry = vi.fn();

      render(
        <CameraView
          stream={null}
          error="Camera access denied"
          hasPermission={false}
          onRetry={mockRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /let me in/i });
      await user.click(retryButton);

      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('should not render retry button when onRetry is not provided', () => {
      render(<CameraView stream={null} error="Camera access denied" hasPermission={false} />);

      const retryButton = screen.queryByRole('button', { name: /let me in/i });
      expect(retryButton).not.toBeInTheDocument();
    });
  });

  describe('Loading State (Permission Request)', () => {
    it('should render loading message when hasPermission is null', () => {
      render(<CameraView stream={null} error={null} hasPermission={null} />);

      expect(screen.getByText('Summoning camera...')).toBeInTheDocument();
    });

    it('should not render video element when hasPermission is null', () => {
      const { container } = render(<CameraView stream={null} error={null} hasPermission={null} />);

      const video = container.querySelector('video');
      expect(video).not.toBeInTheDocument();
    });

    it('should render loading message when stream is null even if hasPermission is true', () => {
      render(<CameraView stream={null} error={null} hasPermission={true} />);

      expect(screen.getByText('Summoning camera...')).toBeInTheDocument();
    });
  });

  describe('Active Camera State', () => {
    let mockStream: MediaStream;

    beforeEach(() => {
      // Create a proper mock MediaStream instance that happy-dom will accept
      mockStream = new MediaStream();
    });

    it('should render video element when stream is provided', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const video = container.querySelector('video');
      expect(video).toBeInTheDocument();
    });

    it('should set video srcObject to the provided stream', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video.srcObject).toBe(mockStream);
    });

    it('should set autoPlay attribute on video element', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video.autoplay).toBe(true);
    });

    it('should set playsInline attribute on video element', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const video = container.querySelector('video') as HTMLVideoElement;
      // Check for the attribute directly since happy-dom may not support the playsInline property
      expect(video.hasAttribute('playsinline')).toBe(true);
    });

    it('should set muted attribute on video element', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video.muted).toBe(true);
    });

    it('should update video srcObject when stream changes', () => {
      const { container, rerender } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video.srcObject).toBe(mockStream);

      // Create a new mock stream
      const newMockStream = new MediaStream();

      rerender(<CameraView stream={newMockStream} error={null} hasPermission={true} />);

      expect(video.srcObject).toBe(newMockStream);
    });
  });

  describe('Overlay UI Elements', () => {
    let mockStream: MediaStream;

    beforeEach(() => {
      mockStream = new MediaStream();
    });

    it('should not render instruction text when camera is active', () => {
      render(<CameraView stream={mockStream} error={null} hasPermission={true} />);

      expect(screen.queryByText('Point camera at a photo to play music')).not.toBeInTheDocument();
    });

    it('should hide instructions when error state is shown', () => {
      render(<CameraView stream={null} error="Camera access denied" hasPermission={false} />);

      expect(screen.queryByText('Point camera at a photo to play music')).not.toBeInTheDocument();
    });

    it('should hide instructions when loading', () => {
      render(<CameraView stream={null} error={null} hasPermission={null} />);

      expect(screen.queryByText('Point camera at a photo to play music')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    let mockStream: MediaStream;

    beforeEach(() => {
      mockStream = new MediaStream();
    });

    it('should render with full viewport classes', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const mainContainer = container.querySelector('[class*="container"]');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should apply object-cover to video for proper scaling', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const video = container.querySelector('video');
      // Verify video element has the CSS Module class applied
      expect(video?.className).toContain('video');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null stream with hasPermission true gracefully', () => {
      render(<CameraView stream={null} error={null} hasPermission={true} />);

      // Should render loading state, not crash
      expect(screen.getByText('Summoning camera...')).toBeInTheDocument();
    });

    it('should handle error message being null', () => {
      render(<CameraView stream={null} error={null} hasPermission={false} />);

      expect(screen.getByText('Camera blocked')).toBeInTheDocument();
      // Error text should be empty but not crash
      const errorContainer = screen.getByText('Camera blocked').parentElement;
      expect(errorContainer).toBeInTheDocument();
    });

    it('should handle undefined onRetry gracefully', () => {
      const { container } = render(
        <CameraView stream={null} error="Error" hasPermission={false} onRetry={undefined} />
      );

      const retryButton = container.querySelector('button');
      expect(retryButton).not.toBeInTheDocument();
    });
  });

  describe('Grayscale Mode', () => {
    let mockStream: MediaStream;

    beforeEach(() => {
      mockStream = new MediaStream();
    });

    it('should not apply grayscale filter by default', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const video = container.querySelector('video');
      expect(video?.className).not.toContain('grayscale');
    });

    it('should apply grayscale filter when grayscale prop is true', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} grayscale={true} />
      );

      const video = container.querySelector('video');
      expect(video?.className).toContain('grayscale');
    });

    it('should not apply grayscale filter when grayscale prop is false', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} grayscale={false} />
      );

      const video = container.querySelector('video');
      expect(video?.className).not.toContain('grayscale');
    });

    it('should toggle grayscale filter when prop changes', () => {
      const { container, rerender } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} grayscale={false} />
      );

      let video = container.querySelector('video');
      expect(video?.className).not.toContain('grayscale');

      rerender(
        <CameraView stream={mockStream} error={null} hasPermission={true} grayscale={true} />
      );

      video = container.querySelector('video');
      expect(video?.className).toContain('grayscale');
    });
  });

  describe('Aspect Ratio Support', () => {
    let mockStream: MediaStream;

    beforeEach(() => {
      mockStream = new MediaStream();
    });

    it('should render without aspect ratio guides', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const aspectRatioContainer = container.querySelector('[class*="overlayAspectRatio"]');
      expect(aspectRatioContainer).not.toBeInTheDocument();
    });
  });

  describe('Instruction Visibility', () => {
    let mockStream: MediaStream;

    beforeEach(() => {
      mockStream = new MediaStream();
    });

    it('should not show instructions by default during active camera state', () => {
      render(<CameraView stream={mockStream} error={null} hasPermission={true} />);

      expect(screen.queryByText('Point camera at a photo to play music')).not.toBeInTheDocument();
    });
  });

  describe('Rectangle Detection Overlay', () => {
    let mockStream: MediaStream;
    const mockRectangle = {
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.9, y: 0.1 },
      bottomRight: { x: 0.9, y: 0.9 },
      bottomLeft: { x: 0.1, y: 0.9 },
      width: 0.8,
      height: 0.8,
      aspectRatio: 1,
    };

    beforeEach(() => {
      mockStream = new MediaStream();
    });

    it('should not show overlay status text when rectangle detected below confidence threshold', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          showRectangleOverlay={true}
          detectedRectangle={mockRectangle}
          rectangleConfidence={0.3}
          rectangleDetectionConfidenceThreshold={0.6}
        />
      );

      expect(screen.queryByText('Detecting photo...')).not.toBeInTheDocument();
    });

    it('should not show overlay status text when rectangle confidence meets threshold', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          showRectangleOverlay={true}
          detectedRectangle={mockRectangle}
          rectangleConfidence={0.8}
          rectangleDetectionConfidenceThreshold={0.6}
        />
      );

      expect(screen.queryByText('Photo detected!')).not.toBeInTheDocument();
    });

    it('should not render overlay when showRectangleOverlay is false', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          showRectangleOverlay={false}
          detectedRectangle={mockRectangle}
          rectangleConfidence={0.8}
        />
      );

      expect(screen.queryByText('Photo detected!')).not.toBeInTheDocument();
      expect(screen.queryByText('Detecting photo...')).not.toBeInTheDocument();
    });

    it('should not render overlay when detectedRectangle is null', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          showRectangleOverlay={true}
          detectedRectangle={null}
          rectangleConfidence={0}
        />
      );

      expect(screen.queryByText('Photo detected!')).not.toBeInTheDocument();
      expect(screen.queryByText('Detecting photo...')).not.toBeInTheDocument();
    });

    it('renders perspective polygon overlay when rectangle is present', () => {
      const { container } = render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          showRectangleOverlay={true}
          detectedRectangle={mockRectangle}
          rectangleConfidence={0.85}
          rectangleDetectionConfidenceThreshold={0.6}
        />
      );

      expect(container.querySelector('svg path')).toBeInTheDocument();
    });
  });
});
