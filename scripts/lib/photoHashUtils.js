#!/usr/bin/env node

/* eslint-env node */

import { createCanvas, loadImage } from 'canvas';

export const DEFAULT_EXPOSURE_OFFSETS = [-50, 0, 50];

function resizeImageData(imageData, width, height) {
  if (imageData.width === width && imageData.height === height) {
    return imageData;
  }

  const sourceCanvas = createCanvas(imageData.width, imageData.height);
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  sourceCtx.putImageData(imageData, 0, 0);

  const targetCanvas = createCanvas(width, height);
  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  targetCtx.drawImage(sourceCanvas, 0, 0, width, height);

  return targetCtx.getImageData(0, 0, width, height);
}

function toGrayscale(imageData) {
  const grayscale = [];
  const { data } = imageData;
  const LUMA_RED = 0.299;
  const LUMA_GREEN = 0.587;
  const LUMA_BLUE = 0.114;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = Math.floor(LUMA_RED * r + LUMA_GREEN * g + LUMA_BLUE * b);
    grayscale.push(luma);
  }

  return grayscale;
}

function binaryToHex(binary) {
  let hex = '';
  for (let i = 0; i < binary.length; i += 4) {
    const chunk = binary.slice(i, i + 4);
    const value = parseInt(chunk, 2);
    hex += value.toString(16);
  }
  return hex;
}

function computeDCT(matrix, size) {
  const dct = Array(size)
    .fill(0)
    .map(() => Array(size).fill(0));

  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;

      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const cosU = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size));
          const cosV = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
          sum += matrix[x][y] * cosU * cosV;
        }
      }

      const alphaU = u === 0 ? 1 / Math.sqrt(2) : 1;
      const alphaV = v === 0 ? 1 / Math.sqrt(2) : 1;
      dct[u][v] = (alphaU * alphaV * sum) / 2;
    }
  }

  return dct;
}

export function computeDHash(imageData) {
  const resized = resizeImageData(imageData, 17, 8);
  const grayscale = toGrayscale(resized);
  let binaryHash = '';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 16; col++) {
      const currentIndex = row * 17 + col;
      const nextIndex = currentIndex + 1;
      const currentPixel = grayscale[currentIndex];
      const nextPixel = grayscale[nextIndex];
      binaryHash += currentPixel > nextPixel ? '1' : '0';
    }
  }

  return binaryToHex(binaryHash);
}

export function computePHash(imageData) {
  const resized = resizeImageData(imageData, 32, 32);
  const grayscaleArray = toGrayscale(resized);
  const matrix = [];
  for (let i = 0; i < 32; i++) {
    matrix[i] = grayscaleArray.slice(i * 32, (i + 1) * 32);
  }

  const dct = computeDCT(matrix, 32);
  const lowFreq = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      if (u === 0 && v === 0) {
        continue;
      }
      lowFreq.push(dct[u][v]);
    }
  }

  const sorted = [...lowFreq].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let binaryHash = '';
  for (const coeff of lowFreq) {
    binaryHash += coeff > median ? '1' : '0';
  }

  return binaryToHex(binaryHash);
}

export function adjustBrightness(imageData, delta) {
  const { width, height, data } = imageData;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const adjusted = ctx.createImageData(width, height);

  for (let i = 0; i < data.length; i += 4) {
    adjusted.data[i] = Math.max(0, Math.min(255, data[i] + delta));
    adjusted.data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + delta));
    adjusted.data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + delta));
    adjusted.data[i + 3] = data[i + 3];
  }

  return adjusted;
}

export async function loadImageData(imagePath) {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function createExposureVariants(imageData, offsets = DEFAULT_EXPOSURE_OFFSETS) {
  return offsets.map((offset) => {
    if (offset === 0) {
      return imageData;
    }
    return adjustBrightness(imageData, offset);
  });
}

export function generateHashVariants(imageData, offsets = DEFAULT_EXPOSURE_OFFSETS) {
  const variants = createExposureVariants(imageData, offsets);
  return {
    phash: variants.map((variant) => computePHash(variant)),
    dhash: variants.map((variant) => computeDHash(variant)),
  };
}

export async function generateHashesForFile(imagePath, offsets = DEFAULT_EXPOSURE_OFFSETS) {
  const imageData = await loadImageData(imagePath);
  return generateHashVariants(imageData, offsets);
}
