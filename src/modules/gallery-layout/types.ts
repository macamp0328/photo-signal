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

  /** Camera view component to render (may include photo overlay when matched) */
  cameraView: ReactNode;

  /** Callback when user wants to activate camera */
  onActivate: () => void;

  /** Callback when user taps the settings icon */
  onSettingsClick: () => void;

  /** Audio controls rendered in a fixed bottom strip */
  audioControls?: ReactNode;
}
