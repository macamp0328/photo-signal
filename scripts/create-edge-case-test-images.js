#!/usr/bin/env node

/**
 * Generate edge case test images for photo recognition testing
 *
 * Creates synthetic test images covering:
 * - Motion blur
 * - Glare/reflections
 * - Low-light conditions
 * - Extreme angles
 *
 * Based on photo-recognition failure categories used by the runtime telemetry model.
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = join(__dirname, '..', 'assets', 'test-images');

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Create a base concert photo simulation
 */
function createBaseConcertPhoto(width = 640, height = 480) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Dark concert atmosphere background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f3460');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Stage lighting effect (spotlights)
  const spotlights = [
    { x: width * 0.3, y: height * 0.3, radius: 80, color: 'rgba(255, 200, 100, 0.3)' },
    { x: width * 0.7, y: height * 0.3, radius: 80, color: 'rgba(100, 150, 255, 0.3)' },
  ];

  spotlights.forEach(({ x, y, radius, color }) => {
    const spotGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    spotGradient.addColorStop(0, color);
    spotGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotGradient;
    ctx.fillRect(0, 0, width, height);
  });

  // Silhouettes (crowd)
  ctx.fillStyle = '#0a0a0a';
  for (let i = 0; i < 20; i++) {
    const x = (width / 21) * (i + 1);
    const crowdHeight = height * 0.2 + Math.random() * height * 0.1;
    ctx.fillRect(x - 10, height - crowdHeight, 20, crowdHeight);
  }

  // Band equipment silhouettes
  ctx.fillStyle = '#050505';
  // Drums
  ctx.fillRect(width * 0.45, height * 0.6, 60, 40);
  ctx.beginPath();
  ctx.arc(width * 0.475, height * 0.65, 15, 0, Math.PI * 2);
  ctx.fill();

  // Guitar amp
  ctx.fillRect(width * 0.2, height * 0.5, 40, 60);

  // Mic stand
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width * 0.6, height * 0.8);
  ctx.lineTo(width * 0.65, height * 0.4);
  ctx.stroke();

  return canvas;
}

/**
 * Apply motion blur effect
 */
function applyMotionBlur(canvas, intensity = 10) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const blurred = ctx.createImageData(canvas.width, canvas.height);

  // Simple horizontal motion blur
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      for (let dx = -intensity; dx <= intensity; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < canvas.width) {
          const idx = (y * canvas.width + nx) * 4;
          r += imageData.data[idx];
          g += imageData.data[idx + 1];
          b += imageData.data[idx + 2];
          count++;
        }
      }

      const idx = (y * canvas.width + x) * 4;
      blurred.data[idx] = r / count;
      blurred.data[idx + 1] = g / count;
      blurred.data[idx + 2] = b / count;
      blurred.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(blurred, 0, 0);
}

/**
 * Apply glare effect (specular highlights)
 */
function applyGlare(canvas, glareCount = 3) {
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < glareCount; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = 40 + Math.random() * 60;

    const glareGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glareGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    glareGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    glareGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = glareGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * Apply low-light effect (reduce brightness and increase noise)
 */
function applyLowLight(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < imageData.data.length; i += 4) {
    // Darken by 70%
    imageData.data[i] *= 0.3;
    imageData.data[i + 1] *= 0.3;
    imageData.data[i + 2] *= 0.3;

    // Add noise
    const noise = (Math.random() - 0.5) * 20;
    imageData.data[i] += noise;
    imageData.data[i + 1] += noise;
    imageData.data[i + 2] += noise;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply perspective distortion (simulate angle)
 */
function applyPerspective(canvas, angle = 30) {
  const tempCanvas = createCanvas(canvas.width, canvas.height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Simple trapezoid transform to simulate viewing angle
  const skew = Math.tan((angle * Math.PI) / 180) * canvas.height * 0.3;

  ctx.save();
  ctx.transform(1, 0, -skew / canvas.height, 1, skew, 0);
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();
}

/**
 * Generate all test images
 */
function generateTestImages() {
  console.log('Generating edge case test images...\n');

  const images = [
    {
      name: 'edge-case-motion-blur-light',
      description: 'Light motion blur (5px)',
      modifier: (canvas) => applyMotionBlur(canvas, 5),
    },
    {
      name: 'edge-case-motion-blur-moderate',
      description: 'Moderate motion blur (10px)',
      modifier: (canvas) => applyMotionBlur(canvas, 10),
    },
    {
      name: 'edge-case-motion-blur-heavy',
      description: 'Heavy motion blur (15px)',
      modifier: (canvas) => applyMotionBlur(canvas, 15),
    },
    {
      name: 'edge-case-glare-light',
      description: 'Light glare (1 reflection)',
      modifier: (canvas) => applyGlare(canvas, 1),
    },
    {
      name: 'edge-case-glare-moderate',
      description: 'Moderate glare (2 reflections)',
      modifier: (canvas) => applyGlare(canvas, 2),
    },
    {
      name: 'edge-case-glare-heavy',
      description: 'Heavy glare (3+ reflections)',
      modifier: (canvas) => applyGlare(canvas, 3),
    },
    {
      name: 'edge-case-low-light',
      description: 'Low-light conditions',
      modifier: (canvas) => applyLowLight(canvas),
    },
    {
      name: 'edge-case-angle-15deg',
      description: '15-degree viewing angle',
      modifier: (canvas) => applyPerspective(canvas, 15),
    },
    {
      name: 'edge-case-angle-30deg',
      description: '30-degree viewing angle',
      modifier: (canvas) => applyPerspective(canvas, 30),
    },
    {
      name: 'edge-case-angle-45deg',
      description: '45-degree viewing angle',
      modifier: (canvas) => applyPerspective(canvas, 45),
    },
    {
      name: 'edge-case-combined-blur-glare',
      description: 'Combined motion blur and glare',
      modifier: (canvas) => {
        applyMotionBlur(canvas, 10);
        applyGlare(canvas, 2);
      },
    },
    {
      name: 'edge-case-combined-angle-lowlight',
      description: 'Combined 30-degree angle and low light',
      modifier: (canvas) => {
        applyPerspective(canvas, 30);
        applyLowLight(canvas);
      },
    },
  ];

  images.forEach(({ name, description, modifier }) => {
    const canvas = createBaseConcertPhoto();
    modifier(canvas);

    const buffer = canvas.toBuffer('image/png');
    const outputPath = join(OUTPUT_DIR, `${name}.png`);
    writeFileSync(outputPath, buffer);

    console.log(`✓ Created ${name}.png - ${description}`);
  });

  console.log(`\n✅ Successfully generated ${images.length} edge case test images`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
}

// Run the generator
generateTestImages();
