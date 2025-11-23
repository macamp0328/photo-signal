/**
 * Motion Detection Module Types
 */

export interface MotionDetectionHook {
  /** True if motion is currently detected */
  isMoving: boolean;
  /** Current sensitivity level (0-100) */
  sensitivity: number;
  /** Update sensitivity level */
  setSensitivity: (value: number) => void;
}

export interface MotionDetectionOptions {
  /** Sensitivity level 0-100, default 50 */
  sensitivity?: number;
  /** Interval between checks in ms, default 500 */
  checkInterval?: number;
  /** Enable/disable motion detection, default true */
  enabled?: boolean;
}
