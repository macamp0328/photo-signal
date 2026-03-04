/**
 * Type declarations for Web APIs not yet in TypeScript's standard lib.
 *
 * requestVideoFrame — https://wicg.github.io/video-rvfc/
 * OffscreenCanvasRenderingContext2D — partial augmentation for willReadFrequently
 */

interface VideoFrameCallbackMetadata {
  presentationTime: DOMHighResTimeStamp;
  expectedDisplayTime: DOMHighResTimeStamp;
  width: number;
  height: number;
  mediaTime: number;
  presentedFrames: number;
  processingDuration?: number;
  captureTime?: DOMHighResTimeStamp;
  receiveTime?: DOMHighResTimeStamp;
  rtpTimestamp?: number;
}

type VideoFrameRequestCallback = (
  now: DOMHighResTimeStamp,
  metadata: VideoFrameCallbackMetadata
) => void;

interface HTMLVideoElement {
  requestVideoFrame(callback: VideoFrameRequestCallback): number;
  cancelVideoFrameCallback(handle: number): void;
}
