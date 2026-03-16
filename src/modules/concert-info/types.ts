import type { Concert } from '../../types';

/**
 * Concert Info Display Module Types
 */

export interface InfoDisplayProps {
  /** Concert to display, null to hide */
  concert: Concert | null;
  /** Control visibility independently of concert data */
  isVisible: boolean;
  /** Optional callback when user moves to the next photo */
  onClose?: () => void;
}
