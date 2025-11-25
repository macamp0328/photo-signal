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

      expect(screen.getByText('Camera Access Required')).toBeInTheDocument();
      expect(screen.getByText('Camera access denied by user')).toBeInTheDocument();
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

      const retryButton = screen.getByRole('button', { name: /retry/i });
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

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('should not render retry button when onRetry is not provided', () => {
      render(<CameraView stream={null} error="Camera access denied" hasPermission={false} />);

      const retryButton = screen.queryByRole('button', { name: /retry/i });
      expect(retryButton).not.toBeInTheDocument();
    });
  });

  describe('Loading State (Permission Request)', () => {
    it('should render loading message when hasPermission is null', () => {
      render(<CameraView stream={null} error={null} hasPermission={null} />);

      expect(screen.getByText('Requesting camera access...')).toBeInTheDocument();
    });

    it('should not render video element when hasPermission is null', () => {
      const { container } = render(<CameraView stream={null} error={null} hasPermission={null} />);

      const video = container.querySelector('video');
      expect(video).not.toBeInTheDocument();
    });

    it('should render loading message when stream is null even if hasPermission is true', () => {
      render(<CameraView stream={null} error={null} hasPermission={true} />);

      expect(screen.getByText('Requesting camera access...')).toBeInTheDocument();
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

    it('should render instruction text when camera is active', () => {
      render(<CameraView stream={mockStream} error={null} hasPermission={true} />);

      expect(screen.getByText('Point camera at a photo to play music')).toBeInTheDocument();
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
      expect(screen.getByText('Requesting camera access...')).toBeInTheDocument();
    });

    it('should handle error message being null', () => {
      render(<CameraView stream={null} error={null} hasPermission={false} />);

      expect(screen.getByText('Camera Access Required')).toBeInTheDocument();
      // Error text should be empty but not crash
      const errorContainer = screen.getByText('Camera Access Required').parentElement;
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

  describe('Concert Info Overlay', () => {
    let mockStream: MediaStream;
    const mockConcert = {
      id: 1,
      band: 'The Beatles',
      venue: 'Shea Stadium',
      date: '1965-08-15T19:30:00-05:00',
      audioFile: '/audio/beatles.opus',
    };

    beforeEach(() => {
      mockStream = new MediaStream();
    });

    it('should not render concert overlay when concertInfo is null', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={null}
          showConcertOverlay={true}
        />
      );

      expect(screen.queryByText('The Beatles')).not.toBeInTheDocument();
    });

    it('should not render concert overlay when showConcertOverlay is false', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={mockConcert}
          showConcertOverlay={false}
        />
      );

      expect(screen.queryByText('The Beatles')).not.toBeInTheDocument();
    });

    it('should render concert overlay when both concertInfo and showConcertOverlay are provided', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={mockConcert}
          showConcertOverlay={true}
        />
      );

      expect(screen.getByText('The Beatles')).toBeInTheDocument();
      expect(screen.getByText('Shea Stadium')).toBeInTheDocument();
      expect(screen.getByText('August 15, 1965')).toBeInTheDocument();
      expect(screen.getByText('Now Playing')).toBeInTheDocument();
    });

    it('should format date correctly in concert overlay', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={mockConcert}
          showConcertOverlay={true}
        />
      );

      expect(screen.getByText('August 15, 1965')).toBeInTheDocument();
    });

    it('should show only the date portion when concertInfo includes a timestamp', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={{ ...mockConcert, date: '1965-08-15T19:30:00-05:00' }}
          showConcertOverlay={true}
        />
      );

      expect(screen.getByText('August 15, 1965')).toBeInTheDocument();
    });

    it('should render concert overlay with proper structure', () => {
      const { container } = render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={mockConcert}
          showConcertOverlay={true}
        />
      );

      const overlay = container.querySelector('[class*="concertOverlay"]');
      const card = container.querySelector('[class*="concertCard"]');
      const header = container.querySelector('[class*="concertHeader"]');
      const details = container.querySelector('[class*="concertDetails"]');
      const footer = container.querySelector('[class*="concertFooter"]');

      expect(overlay).toBeInTheDocument();
      expect(card).toBeInTheDocument();
      expect(header).toBeInTheDocument();
      expect(details).toBeInTheDocument();
      expect(footer).toBeInTheDocument();
    });

    it('should not render concert overlay when camera is in error state', () => {
      render(
        <CameraView
          stream={null}
          error="Camera access denied"
          hasPermission={false}
          concertInfo={mockConcert}
          showConcertOverlay={true}
        />
      );

      expect(screen.queryByText('The Beatles')).not.toBeInTheDocument();
    });

    it('should not render concert overlay when camera is in loading state', () => {
      render(
        <CameraView
          stream={null}
          error={null}
          hasPermission={null}
          concertInfo={mockConcert}
          showConcertOverlay={true}
        />
      );

      expect(screen.queryByText('The Beatles')).not.toBeInTheDocument();
    });

    it('should hide instructions when concert overlay is shown', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={mockConcert}
          showConcertOverlay={true}
        />
      );

      expect(screen.queryByText('Point camera at a photo to play music')).not.toBeInTheDocument();
    });

    it('should hide instructions when concert is recognized but overlay is disabled', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={mockConcert}
          showConcertOverlay={false}
        />
      );

      expect(screen.queryByText('Point camera at a photo to play music')).not.toBeInTheDocument();
    });

    it('should show instructions while awaiting a match', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={null}
          showConcertOverlay={false}
        />
      );

      expect(screen.getByText('Point camera at a photo to play music')).toBeInTheDocument();
    });
  });
});
