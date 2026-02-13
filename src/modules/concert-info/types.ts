import type { ReactNode } from 'react';
import type { Concert } from '../../types';

/**
 * Concert Info Display Module Types
 */

export interface InfoDisplayProps {
  /** Concert to display, null to hide */
  concert: Concert | null;
  /** Control visibility independently of concert data */
  isVisible: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Label describing the state of this concert (e.g., Now Playing, Now Viewing) */
  statusLabel?: string;
  /** Optional prompt or helper text shown below details */
  promptText?: string;
  /** Optional action controls rendered beneath the details */
  actions?: ReactNode;
  /** Optional now-playing line shown beneath metadata */
  nowPlayingLine?: string;
  /** Progress value (0-1) to drive accent styling on the now-playing line */
  progressValue?: number;
  /** Optional accent color for the progress indicator */
  progressColor?: string;
}
