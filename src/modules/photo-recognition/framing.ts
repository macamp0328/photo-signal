import type { AspectRatio } from './types';

export interface ViewportRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const calculateVisibleViewport = (
  videoWidth: number,
  videoHeight: number,
  displayAspectRatio: number = 1
): ViewportRegion => {
  const safeRatio = displayAspectRatio > 0 ? displayAspectRatio : videoWidth / videoHeight;
  const videoRatio = videoWidth / videoHeight;

  if (!Number.isFinite(videoRatio) || !Number.isFinite(safeRatio)) {
    return { x: 0, y: 0, width: videoWidth, height: videoHeight };
  }

  if (Math.abs(videoRatio - safeRatio) < 0.001) {
    return { x: 0, y: 0, width: videoWidth, height: videoHeight };
  }

  if (videoRatio > safeRatio) {
    const height = videoHeight;
    const width = Math.round(height * safeRatio);
    const x = Math.round((videoWidth - width) / 2);
    return { x, y: 0, width, height };
  }

  const width = videoWidth;
  const height = Math.round(width / safeRatio);
  const y = Math.round((videoHeight - height) / 2);
  return { x: 0, y, width, height };
};

export function calculateFramedRegion(
  videoWidth: number,
  videoHeight: number,
  aspectRatio: AspectRatio,
  scale: number = 0.8
): { x: number; y: number; width: number; height: number } {
  const targetRatio = aspectRatio === '3:2' ? 3 / 2 : aspectRatio === '2:3' ? 2 / 3 : 1;
  const videoRatio = videoWidth / videoHeight;

  let frameWidth: number;
  let frameHeight: number;

  if (videoRatio > targetRatio) {
    frameHeight = videoHeight * scale;
    frameWidth = frameHeight * targetRatio;
  } else {
    frameWidth = videoWidth * scale;
    frameHeight = frameWidth / targetRatio;
  }

  return {
    x: Math.round((videoWidth - frameWidth) / 2),
    y: Math.round((videoHeight - frameHeight) / 2),
    width: Math.round(frameWidth),
    height: Math.round(frameHeight),
  };
}
