import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GalleryLayout } from './GalleryLayout';

describe('GalleryLayout', () => {
  const mockOnActivate = vi.fn();
  const mockOnSettingsClick = vi.fn();
  const mockCameraView = <div data-testid="camera-view">Camera View</div>;
  const mockAudioControls = <div data-testid="audio-controls">Audio Controls</div>;

  it('renders landing view when not active', () => {
    render(
      <GalleryLayout
        isActive={false}
        cameraView={mockCameraView}
        onActivate={mockOnActivate}
        onSettingsClick={mockOnSettingsClick}
      />
    );

    // Check for new landing copy
    expect(screen.getByText(/Still/i)).toBeTruthy();
    expect(screen.getByText(/Broadcasting/i)).toBeTruthy();
    expect(screen.getByText(/some photographs never stopped/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Activate camera and begin experience' })
    ).toBeTruthy();

    // Camera should not be visible on landing
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });

  it('calls onActivate when Tune in button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <GalleryLayout
        isActive={false}
        cameraView={mockCameraView}
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
        onActivate={mockOnActivate}
        onSettingsClick={mockOnSettingsClick}
      />
    );

    // Watermark label is present
    expect(screen.getByText('Photo Signal')).toBeTruthy();

    // Camera should be visible
    expect(screen.getByTestId('camera-view')).toBeTruthy();

    // No old "Begin" button in active view
    expect(
      screen.queryByRole('button', { name: 'Activate camera and begin experience' })
    ).toBeNull();
  });

  it('renders settings icon when active', async () => {
    const user = userEvent.setup();
    render(
      <GalleryLayout
        isActive={true}
        cameraView={mockCameraView}
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
        onActivate={mockOnActivate}
        onSettingsClick={mockOnSettingsClick}
      />
    );

    expect(screen.queryByTestId('audio-controls')).toBeNull();
  });
});
