/**
 * Gallery Layout Module - Type Definitions
 *
 * Defines the contract for the gallery layout component
 * that provides a zine-like, curated UI experience.
 */

import type { ReactNode } from 'react';

export interface GalleryLayoutProps {
  /** Whether the camera is active */
  isActive: boolean;

  /** Camera view component to render */
  cameraView: ReactNode;

  /** Info display component to render */
  infoDisplay: ReactNode;

  /** Callback when user wants to activate camera */
  onActivate: () => void;

  /** Callback when user taps the settings button in the header */
  onSettingsClick: () => void;

  /** Audio controls rendered in a dedicated section below the info card */
  audioControls?: ReactNode;

  /** Whether to show the info section (defaults to true for stacked layout, set false for overlay mode) */
  showInfoSection?: boolean;
}
