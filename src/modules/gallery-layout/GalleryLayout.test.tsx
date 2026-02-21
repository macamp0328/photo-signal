import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GalleryLayout } from './GalleryLayout';

describe('GalleryLayout', () => {
  const mockOnActivate = vi.fn();
  const mockOnSettingsClick = vi.fn();
  const mockCameraView = <div data-testid="camera-view">Camera View</div>;
  const mockInfoDisplay = <div data-testid="info-display">Info Display</div>;
  const mockAudioControls = <div data-testid="audio-controls">Audio Controls</div>;

  it('renders landing view when not active', () => {
    render(
      <GalleryLayout
        isActive={false}
        cameraView={mockCameraView}
        infoDisplay={mockInfoDisplay}
        onActivate={mockOnActivate}
        onSettingsClick={mockOnSettingsClick}
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
        onSettingsClick={mockOnSettingsClick}
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
        onSettingsClick={mockOnSettingsClick}
      />
    );

    // Check for active view elements
    expect(screen.getByText('Photo Signal')).toBeTruthy();
    expect(screen.getByText(/Point at a photo to begin/i)).toBeTruthy();

    // Camera should be visible
    expect(screen.getByTestId('camera-view')).toBeTruthy();

    // Info display should be visible by default in stacked layout
    expect(screen.getByTestId('info-display')).toBeTruthy();

    // Begin button should not be visible
    expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull();
  });

  it('renders settings button in header when active', async () => {
    const user = userEvent.setup();
    render(
      <GalleryLayout
        isActive={true}
        cameraView={mockCameraView}
        infoDisplay={mockInfoDisplay}
        onActivate={mockOnActivate}
        onSettingsClick={mockOnSettingsClick}
      />
    );

    const settingsButton = screen.getByRole('button', { name: 'Open settings' });
    expect(settingsButton).toBeTruthy();
    await user.click(settingsButton);
    expect(mockOnSettingsClick).toHaveBeenCalledTimes(1);
  });

  it('renders audio controls section when provided', () => {
    render(
      <GalleryLayout
        isActive={true}
        cameraView={mockCameraView}
        infoDisplay={mockInfoDisplay}
        onActivate={mockOnActivate}
        onSettingsClick={mockOnSettingsClick}
        audioControls={mockAudioControls}
      />
    );

    expect(screen.getByTestId('audio-controls')).toBeTruthy();
  });

  it('does not render audio controls section when not provided', () => {
    render(
      <GalleryLayout
        isActive={true}
        cameraView={mockCameraView}
        infoDisplay={mockInfoDisplay}
        onActivate={mockOnActivate}
        onSettingsClick={mockOnSettingsClick}
      />
    );

    expect(screen.queryByTestId('audio-controls')).toBeNull();
  });

  it('hides info section when showInfoSection is false', () => {
    render(
      <GalleryLayout
        isActive={true}
        cameraView={mockCameraView}
        infoDisplay={mockInfoDisplay}
        onActivate={mockOnActivate}
        onSettingsClick={mockOnSettingsClick}
        showInfoSection={false}
      />
    );

    // Camera should be visible, but info should not
    expect(screen.getByTestId('camera-view')).toBeTruthy();
    expect(screen.queryByTestId('info-display')).toBeNull();
  });
});
