#!/usr/bin/env node
/**
 * Regenerate ORB Features for Concert Data
 * 
 * This script regenerates ORB features for all concerts in data.json using
 * the new optimized parameters. This is necessary after changing the default
 * ORB configuration to ensure reference features match the new settings.
 * 
 * Usage: node scripts/regenerate-orb-features.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Import ORB module (we'll need to transpile TS to use it)
// For now, this is a template script showing the approach

const DATA_FILE = path.join(__dirname, '../public/data.json');
const ASSET_DIR = path.join(__dirname, '../public');

async function main() {
  console.log('=== ORB Feature Regeneration Tool ===\n');
  console.log('⚠️  This script requires TypeScript compilation and canvas module.');
  console.log('⚠️  To regenerate features, use the browser-based tool instead:\n');
  console.log('1. Start the dev server: npm run dev');
  console.log('2. Open http://localhost:5173');
  console.log('3. Click the settings gear (top right)');
  console.log('4. Open "Secret Settings"');
  console.log('5. Click "Generate ORB Features" in the Debug Tools section\n');
  console.log('This will generate features with the new optimized parameters:');
  console.log('  - scaleFactor: 1.5 (was 1.2)');
  console.log('  - edgeThreshold: 15 (was 31)');
  console.log('  - fastThreshold: 12 (was 20)');
  console.log('  - matchRatioThreshold: 0.75 (was 0.7)');
  console.log('  - maxFeatures: 1000 (was 500)\n');
  
  // Load current data
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  
  console.log(`Found ${data.concerts.length} concerts in data.json`);
  
  const concertsWithORB = data.concerts.filter(c => c.orbFeatures);
  const concertsNeedingRegeneration = concertsWithORB.filter(c => {
    const config = c.orbFeatures?.config || {};
    return config.scaleFactor !== 1.5 || config.edgeThreshold !== 15 || config.fastThreshold !== 12;
  });
  
  console.log(`Concerts with ORB features: ${concertsWithORB.length}`);
  console.log(`Concerts needing regeneration: ${concertsNeedingRegeneration.length}\n`);
  
  if (concertsNeedingRegeneration.length > 0) {
    console.log('Concerts to regenerate:');
    concertsNeedingRegeneration.forEach(c => {
      const old = c.orbFeatures?.config || {};
      console.log(`  - ${c.band} (${c.imageFile})`);
      console.log(`    Old config: scaleFactor=${old.scaleFactor}, edgeThreshold=${old.edgeThreshold}, fastThreshold=${old.fastThreshold}`);
    });
  } else {
    console.log('✓ All concerts already have up-to-date ORB features!');
  }
}

main().catch(console.error);
