/**
 * Recognition Worker Protocol
 *
 * Typed message interfaces for communication between the main thread and the
 * recognition Web Worker. The worker handles the compute-heavy pipeline
 * (pHash + Hamming matching + quality metrics) while the main thread retains
 * frame capture, rectangle detection, and React state management.
 */

// ---------------------------------------------------------------------------
// Shared lightweight types (avoid importing full Concert into the worker)
// ---------------------------------------------------------------------------

/** Minimal hash entry sent to the worker at init time. */
export interface WorkerHashEntry {
  hash: string;
  concertId: number;
}

/** Quality thresholds forwarded to the worker so it can gate/run quality checks. */
export interface WorkerQualityConfig {
  sharpnessThreshold: number;
  glareThreshold: number;
  glarePercentageThreshold: number;
  minBrightness: number;
  maxBrightness: number;
}

/** Recognition thresholds forwarded to the worker for matching decisions. */
export interface WorkerRecognitionConfig {
  similarityThreshold: number;
  matchMarginThreshold: number;
  qualityGatingDistanceThreshold: number;
  quality: WorkerQualityConfig;
}

// ---------------------------------------------------------------------------
// Main → Worker messages
// ---------------------------------------------------------------------------

export interface WorkerInitMessage {
  type: 'init';
  hashEntries: WorkerHashEntry[];
  config: WorkerRecognitionConfig;
}

export interface WorkerFrameMessage {
  type: 'frame';
  /** Transferable ImageBitmap captured at 128×128 from the framed region. */
  bitmap: ImageBitmap;
  /** Monotonically increasing frame identifier for correlating results. */
  frameId: number;
}

export interface WorkerConfigUpdateMessage {
  type: 'config-update';
  config: WorkerRecognitionConfig;
}

export type MainToWorkerMessage =
  | WorkerInitMessage
  | WorkerFrameMessage
  | WorkerConfigUpdateMessage;

// ---------------------------------------------------------------------------
// Worker → Main messages
// ---------------------------------------------------------------------------

export interface WorkerMatchResult {
  concertId: number;
  distance: number;
}

export interface WorkerQualityResult {
  sharpness: number;
  isSharp: boolean;
  glarePercentage: number;
  hasGlare: boolean;
  averageBrightness: number;
  hasPoorLighting: boolean;
  lightingType: 'underexposed' | 'overexposed' | 'ok';
}

export interface WorkerFrameResult {
  type: 'result';
  frameId: number;
  hash: string;
  bestMatch: WorkerMatchResult | null;
  secondBestMatch: WorkerMatchResult | null;
  /** null when quality checks were skipped (distance ≤ gating threshold). */
  quality: WorkerQualityResult | null;
  /** Total worker-side processing time in milliseconds. */
  processingMs: number;
}

export interface WorkerReadyMessage {
  type: 'ready';
  hashCount: number;
}

export interface WorkerErrorMessage {
  type: 'error';
  message: string;
  frameId?: number;
}

export type WorkerToMainMessage = WorkerFrameResult | WorkerReadyMessage | WorkerErrorMessage;
