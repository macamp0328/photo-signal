/**
 * Hamming Distance Calculator
 *
 * Computes the Hamming distance between two hash strings.
 * Used to measure similarity between perceptual hashes.
 */

/**
 * Count the number of set bits (1s) in a 32-bit unsigned integer.
 *
 * Uses the standard parallel bit-counting (SWAR) technique, equivalent to
 * the POPCNT instruction on supporting hardware.  This replaces the earlier
 * hex→binary string conversion and avoids string allocation entirely.
 *
 * @param n - Unsigned 32-bit integer (caller must ensure n >>> 0 === n)
 * @returns Number of set bits (0–32)
 */
function popcount32(n: number): number {
  // Ensure unsigned 32-bit integer (no-op if already unsigned)
  let x = n >>> 0;
  // Parallel bit summation (SWAR algorithm)
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return Math.imul(x, 0x01010101) >>> 24;
}

/**
 * Calculate Hamming distance between two hash strings
 *
 * The Hamming distance is the number of positions at which
 * the corresponding bits are different. Lower distance means
 * more similar images.
 *
 * Implemented with 32-bit integer XOR + popcount rather than
 * hex→binary string conversion, giving ~5–10× fewer operations
 * for typical 16-char (64-bit) and 32-char (128-bit) hashes.
 *
 * @param hash1 - First hash (hexadecimal string)
 * @param hash2 - Second hash (hexadecimal string)
 * @returns Number of differing bits (0–4*len for a len-char hex hash)
 *
 * @example
 * const distance = hammingDistance('0f0f0f0f', '0f0f0f0e'); // Returns 1
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hash lengths must be equal');
  }

  let distance = 0;

  // Process 8 hex characters (32 bits) at a time.
  // For a standard 16-char pHash this is exactly 2 iterations.
  for (let i = 0; i < hash1.length; i += 8) {
    // slice is safe even when (i + 8) > length — it clamps automatically.
    const chunk1 = hash1.slice(i, i + 8);
    const chunk2 = hash2.slice(i, i + 8);

    // parseInt handles strings shorter than 8 chars correctly; the result is
    // a left-aligned bit pattern.  Both sides are padded identically (with
    // implicit leading significance), so XOR on the extra bits is always 0.
    const n1 = parseInt(chunk1, 16) >>> 0;
    const n2 = parseInt(chunk2, 16) >>> 0;

    distance += popcount32((n1 ^ n2) >>> 0);
  }

  return distance;
}

/**
 * Calculate similarity percentage between two hashes
 *
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @returns Similarity as percentage (0-100)
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  const maxDistance = hash1.length * 4; // 4 bits per hex digit
  const similarity = ((maxDistance - distance) / maxDistance) * 100;

  return Math.round(similarity * 100) / 100; // Round to 2 decimal places
}
