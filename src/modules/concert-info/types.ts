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
  /** Optional callback for closing the visible concert details card */
  onClose?: () => void;
  /** Optional callback for switching to this concert's audio */
  onSwitch?: () => void;
  /** Optional label for the switch button (defaults to "Drop the Needle") */
  switchLabel?: string;
}
