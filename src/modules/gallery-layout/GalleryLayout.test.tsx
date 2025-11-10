import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GalleryLayout } from './GalleryLayout';

describe('GalleryLayout', () => {
  const mockOnActivate = vi.fn();
  const mockCameraView = <div data-testid="camera-view">Camera View</div>;
  const mockInfoDisplay = <div data-testid="info-display">Info Display</div>;

  it('renders landing view when not active', () => {
    render(
      <GalleryLayout
        isActive={false}
        cameraView={mockCameraView}
        infoDisplay={mockInfoDisplay}
        onActivate={mockOnActivate}
      />
    );

    // Check for landing page elements
    expect(screen.getByText('Photo Signal')).toBeTruthy();
    expect(screen.getByText(/Point your camera at a photograph/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Activate camera and begin experience' })
    ).toBeTruthy();

    // Camera and info should not be visible
    expect(screen.queryByTestId('camera-view')).toBeNull();
    expect(screen.queryByTestId('info-display')).toBeNull();
  });

  it('calls onActivate when Begin button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <GalleryLayout
        isActive={false}
        cameraView={mockCameraView}
        infoDisplay={mockInfoDisplay}
        onActivate={mockOnActivate}
      />
    );

    const beginButton = screen.getByRole('button', {
      name: 'Activate camera and begin experience',
    });
    await user.click(beginButton);

    expect(mockOnActivate).toHaveBeenCalledTimes(1);
  });

  it('renders active gallery view when active', () => {
    render(
      <GalleryLayout
        isActive={true}
        cameraView={mockCameraView}
        infoDisplay={mockInfoDisplay}
        onActivate={mockOnActivate}
      />
    );

    // Check for active view elements
    expect(screen.getByText('Photo Signal')).toBeTruthy();
    expect(screen.getByText(/Point at a photo to begin/i)).toBeTruthy();

    // Camera and info should be visible
    expect(screen.getByTestId('camera-view')).toBeTruthy();
    expect(screen.getByTestId('info-display')).toBeTruthy();

    // Begin button should not be visible
    expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull();
  });
});
