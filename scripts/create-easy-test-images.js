#!/usr/bin/env node

/* eslint-env node */

import { createCanvas } from 'canvas';
import { mkdir, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, '../assets/test-images');
const WIDTH = 640;
const HEIGHT = 480;

const designs = [
  {
    filename: 'easy-target-bullseye.png',
    description: 'High-contrast bullseye with center glyph',
    draw(ctx) {
      ctx.fillStyle = '#0b132b';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const rings = [
        { radius: 220, color: '#ff006e' },
        { radius: 170, color: '#f2f230' },
        { radius: 120, color: '#8338ec' },
        { radius: 70, color: '#ffd6a5' },
      ];

      rings.forEach(({ radius, color }) => {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(WIDTH / 2, HEIGHT / 2, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = '#0b132b';
      ctx.font = 'bold 96px "Arial"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◎', WIDTH / 2, HEIGHT / 2);
    },
  },
  {
    filename: 'easy-target-diagonals.png',
    description: 'Bold diagonal bands with contrast text',
    draw(ctx) {
      ctx.fillStyle = '#001219';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const stripeColors = ['#ffb703', '#fb8500', '#219ebc'];
      stripeColors.forEach((color, index) => {
        ctx.save();
        ctx.translate(-WIDTH * 0.4 + index * 120, -HEIGHT * 0.2);
        ctx.rotate(Math.PI / 6);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, WIDTH * 1.2, 140);
        ctx.restore();
      });

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px "Arial"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SLASH', WIDTH / 2, HEIGHT / 2);
    },
  },
  {
    filename: 'easy-target-checker.png',
    description: 'Checkerboard grid with central label',
    draw(ctx) {
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const cellSize = 80;
      for (let y = 0; y < HEIGHT / cellSize; y++) {
        for (let x = 0; x < WIDTH / cellSize; x++) {
          if ((x + y) % 2 === 0) {
            ctx.fillStyle = '#212529';
          } else {
            ctx.fillStyle = '#dee2e6';
          }
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }

      ctx.strokeStyle = '#ff006e';
      ctx.lineWidth = 12;
      ctx.strokeRect(60, 60, WIDTH - 120, HEIGHT - 120);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(WIDTH / 2 - 180, HEIGHT / 2 - 60, 360, 120);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeRect(WIDTH / 2 - 180, HEIGHT / 2 - 60, 360, 120);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 64px "Arial"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GRID', WIDTH / 2, HEIGHT / 2);
    },
  },
];

async function createImages() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log('🎨 Generating easy test images...');
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  for (const design of designs) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.antialias = 'default';

    design.draw(ctx);

    const buffer = canvas.toBuffer('image/png');
    const filepath = path.join(OUTPUT_DIR, design.filename);
    await writeFile(filepath, buffer);
    console.log(`✓ Created ${design.filename} (${design.description})`);
  }

  console.log('\n✅ Easy test images generated successfully!');
}

createImages().catch((error) => {
  console.error('❌ Failed to generate easy test images:', error);
  process.exit(1);
});
