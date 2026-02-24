#!/usr/bin/env node
/**
 * Photo-of-Photo Hash Distance Analyzer
 *
 * This script explains why camera photos of printed photos
 * aren't matching the original digital photo hashes and provides
 * solutions.
 */

/**
 * Calculate similarity percentage from Hamming distance
 */
function similarityPercent(distance, maxDistance = 128) {
  return ((maxDistance - distance) / maxDistance) * 100;
}

function main() {
  console.log('\n📊 Photo-of-Photo Hash Distance Analysis');
  console.log('='.repeat(60));
  console.log('\nThis tool explains why camera photos of printed photos');
  console.log("don't match the original digital photo hashes.\n");

  console.log('🔍 The Problem:');
  console.log('─'.repeat(60));
  console.log('The hashes in data.recognition.v2.json were generated from ORIGINAL digital');
  console.log('photo files (e.g., R0043815.jpg stored on disk).');
  console.log('');
  console.log('When you point your camera at a PRINTED photo, the captured');
  console.log('image is fundamentally different due to:');
  console.log('  • Print quality (ink/toner vs pixels)');
  console.log('  • Paper texture and reflectance');
  console.log('  • Lighting conditions (ambient vs screen backlight)');
  console.log('  • Camera angle and perspective');
  console.log('  • Glare and reflections on photo surface');
  console.log('  • JPEG compression from print process');
  console.log('  • Additional JPEG compression from camera');
  console.log('');
  console.log('These differences cause hash mismatches of 30-70+ bits,');
  console.log('far exceeding the 24-bit threshold (81.3% similarity).');

  console.log('\n📈 Expected Hash Distances:');
  console.log('─'.repeat(60));
  console.log(
    `  Same image:                    0-5 bits   (${similarityPercent(5).toFixed(1)}-100% similar)`
  );
  console.log(
    `  Different exposure/lighting:   5-15 bits  (${similarityPercent(15).toFixed(1)}-${similarityPercent(5).toFixed(1)}% similar)`
  );
  console.log(
    `  Photo of screen display:       15-30 bits (${similarityPercent(30).toFixed(1)}-${similarityPercent(15).toFixed(1)}% similar)`
  );
  console.log(
    `  Photo of printed photo:        30-70 bits (${similarityPercent(70).toFixed(1)}-${similarityPercent(30).toFixed(1)}% similar) ← YOUR CASE`
  );
  console.log(
    `  Different photos entirely:     70-128 bits (0-${similarityPercent(70).toFixed(1)}% similar)`
  );

  console.log('\n⚙️  Current Configuration:');
  console.log('─'.repeat(60));
  console.log('  dHash threshold: 24 bits (requires 81.3% similarity)');
  console.log('  pHash threshold: 12 bits (requires 81.3% similarity)');
  console.log('');
  console.log('  ✗ These thresholds CANNOT match photo-of-printed-photo (30-70 bits)');
  console.log('  ✓ Multi-exposure variants handle lighting (±5-10 bits)');
  console.log('  ✗ But print → camera gap is too large (±30-70 bits)');

  console.log('\n✅ Solution 1: Generate Hashes from Camera Captures (RECOMMENDED)');
  console.log('─'.repeat(60));
  console.log('Instead of using hashes from original digital photos,');
  console.log('generate hashes from camera-captured photos:');
  console.log('');
  console.log('  1. Point your device camera at each printed photo');
  console.log('  2. Take a clear, well-lit photo (or extract frame from screenshot)');
  console.log('  3. Crop to just the photo region (remove background)');
  console.log('  4. Save to a temp folder (e.g., assets/camera-captured)');
  console.log('  5. Generate hashes: npm run hashes:paths -- --paths assets/camera-captured');
  console.log('  6. Copy the output hashes to replace existing hashes in data.recognition.v2.json');
  console.log('');
  console.log('  This gives you hashes that match your ACTUAL setup:');
  console.log('    digital → print → camera');
  console.log('  instead of just:');
  console.log('    digital (mismatch with camera)');

  console.log('\n⚠️  Solution 2: Dramatically Increase Threshold (NOT RECOMMENDED)');
  console.log('─'.repeat(60));
  console.log('  1. Triple-tap landing page to open Secret Settings');
  console.log('  2. Enable "Debug Overlay" to see debug output');
  console.log('  3. Increase "Similarity Threshold" to 50-70');
  console.log('     (dHash: 50 = 60.9% similarity, 70 = 45.3% similarity)');
  console.log('');
  console.log('  ⚠️  WARNING: High risk of false positives!');
  console.log('     At 60-70 bit threshold, different photos may match.');
  console.log('     Only use for testing to confirm this is the issue.');

  console.log('\n🧪 Testing Your Setup:');
  console.log('─'.repeat(60));
  console.log('  1. Enable Debug Overlay in Secret Settings');
  console.log('  2. Point camera at a printed photo');
  console.log('  3. Check console output for distance values:');
  console.log('     • If distance is 30-70: Photo-of-photo issue (use Solution 1)');
  console.log('     • If distance is 15-30: Try multi-scale or increase threshold');
  console.log('     • If distance is 5-15: Should work with current threshold');
  console.log('');
  console.log('  4. The debug overlay shows:');
  console.log('     • Best match and distance for each concert');
  console.log('     • Whether it meets the threshold (✓ or ✗)');
  console.log('');

  console.log('\n📝 Example workflow:');
  console.log('─'.repeat(60));
  console.log('  # Capture photos with your device');
  console.log('  mkdir -p assets/camera-captured');
  console.log('  # ... save camera-captured photos there ...');
  console.log('');
  console.log('  # Generate hashes');
  console.log('  npm run hashes:paths -- --paths assets/camera-captured');
  console.log('');
  console.log('  # Output will show:');
  console.log('  # {');
  console.log('  #   "file": "R0043815-camera.jpg",');
  console.log('  #   "photoHashes": {');
  console.log('  #     "dhash": ["abc123...", "def456...", "ghi789..."]');
  console.log('  #   }');
  console.log('  # }');
  console.log('');
  console.log('  # Copy those hashes to the matching concert in data.recognition.v2.json');
  console.log('');
}

main();
