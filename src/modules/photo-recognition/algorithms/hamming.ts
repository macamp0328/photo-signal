/**
 * Hamming Distance Calculator
 *
 * Computes the Hamming distance between two hash strings.
 * Used to measure similarity between perceptual hashes.
 */

import { hexToBinary } from './utils';

/**
 * Calculate Hamming distance between two hash strings
 *
 * The Hamming distance is the number of positions at which
 * the corresponding bits are different. Lower distance means
 * more similar images.
 *
 * @param hash1 - First hash (hexadecimal string)
 * @param hash2 - Second hash (hexadecimal string)
 * @returns Number of differing bits (0-64 for 64-bit hash)
 *
 * @example
 * const distance = hammingDistance('0f0f0f0f', '0f0f0f0e'); // Returns 1
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hash lengths must be equal');
  }

  const binary1 = hexToBinary(hash1);
  const binary2 = hexToBinary(hash2);

  let distance = 0;

  // Count differing bits
  for (let i = 0; i < binary1.length; i++) {
    if (binary1[i] !== binary2[i]) {
      distance++;
    }
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
