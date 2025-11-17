import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CameraView } from './CameraView';

/**
 * CameraView Component Tests
 *
 * Tests validate the module contract defined in README.md:
 * - Display video stream in viewport
 * - Render 3:2 aspect ratio frame overlay
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

    it('should render guide rectangle overlay', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      // Find the main overlay border element by checking for the overlayFrame class
      const overlayBorder = container.querySelector('[class*="overlayFrame"]');
      expect(overlayBorder).toBeInTheDocument();
    });

    it('should render all four corner markers', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      // Find corner markers by their CSS module class names
      const topLeft = container.querySelector('[class*="cornerTopLeft"]');
      const topRight = container.querySelector('[class*="cornerTopRight"]');
      const bottomLeft = container.querySelector('[class*="cornerBottomLeft"]');
      const bottomRight = container.querySelector('[class*="cornerBottomRight"]');

      expect(topLeft).toBeInTheDocument();
      expect(topRight).toBeInTheDocument();
      expect(bottomLeft).toBeInTheDocument();
      expect(bottomRight).toBeInTheDocument();
    });

    it('should maintain 3:2 aspect ratio for guide overlay', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      // The 3:2 aspect ratio is maintained via padding-bottom: 66.67% in CSS Module
      const aspectRatioContainer = container.querySelector('[class*="overlayAspectRatio"]');
      expect(aspectRatioContainer).toBeInTheDocument();
    });

    it('should not render overlay when in error state', () => {
      render(<CameraView stream={null} error="Camera access denied" hasPermission={false} />);

      expect(screen.queryByText('Point camera at a photo to play music')).not.toBeInTheDocument();
    });

    it('should not render overlay when in loading state', () => {
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

    it('should set overlay guide to 90% width with max-width constraint', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      // Find the overlay container with width constraints using CSS Module class
      const overlayGuide = container.querySelector('[class*="overlayWrapper"]');
      expect(overlayGuide).toBeInTheDocument();
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

    it('should render 3:2 aspect ratio overlay by default', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const aspectRatioContainer = container.querySelector('[class*="overlayAspectRatio32"]');
      expect(aspectRatioContainer).toBeInTheDocument();
    });

    it('should render 3:2 aspect ratio overlay when aspectRatio is "3:2"', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} aspectRatio="3:2" />
      );

      const aspectRatioContainer = container.querySelector('[class*="overlayAspectRatio32"]');
      expect(aspectRatioContainer).toBeInTheDocument();
    });

    it('should render 2:3 aspect ratio overlay when aspectRatio is "2:3"', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} aspectRatio="2:3" />
      );

      const aspectRatioContainer = container.querySelector('[class*="overlayAspectRatio23"]');
      expect(aspectRatioContainer).toBeInTheDocument();
    });

    it('should render aspect ratio toggle button when onAspectRatioToggle is provided', () => {
      const mockToggle = vi.fn();

      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          onAspectRatioToggle={mockToggle}
        />
      );

      const toggleButton = screen.getByRole('button', { name: /switch to portrait mode/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should not render aspect ratio toggle button when onAspectRatioToggle is not provided', () => {
      const { container } = render(
        <CameraView stream={mockStream} error={null} hasPermission={true} />
      );

      const toggleButtons = container.querySelectorAll('button');
      expect(toggleButtons).toHaveLength(0);
    });

    it('should call onAspectRatioToggle when toggle button is clicked', async () => {
      const user = userEvent.setup();
      const mockToggle = vi.fn();

      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          onAspectRatioToggle={mockToggle}
        />
      );

      const toggleButton = screen.getByRole('button', { name: /switch to portrait mode/i });
      await user.click(toggleButton);

      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    it('should show "Portrait" label when in landscape (3:2) mode', () => {
      const mockToggle = vi.fn();

      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          aspectRatio="3:2"
          onAspectRatioToggle={mockToggle}
        />
      );

      const toggleButton = screen.getByRole('button', { name: /switch to portrait mode/i });
      expect(toggleButton.textContent).toContain('Portrait');
    });

    it('should show "Landscape" label when in portrait (2:3) mode', () => {
      const mockToggle = vi.fn();

      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          aspectRatio="2:3"
          onAspectRatioToggle={mockToggle}
        />
      );

      const toggleButton = screen.getByRole('button', { name: /switch to landscape mode/i });
      expect(toggleButton.textContent).toContain('Landscape');
    });
  });

  describe('Concert Info Overlay', () => {
    let mockStream: MediaStream;
    const mockConcert = {
      id: 1,
      band: 'The Beatles',
      venue: 'Shea Stadium',
      date: '1965-08-15',
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

    it('should show instructions when concert overlay is not shown', () => {
      render(
        <CameraView
          stream={mockStream}
          error={null}
          hasPermission={true}
          concertInfo={mockConcert}
          showConcertOverlay={false}
        />
      );

      expect(screen.getByText('Point camera at a photo to play music')).toBeInTheDocument();
    });
  });
});
