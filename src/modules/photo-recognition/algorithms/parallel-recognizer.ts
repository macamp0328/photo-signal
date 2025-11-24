/**
 * Parallel Photo Recognition Orchestrator
 *
 * Runs dhash, phash, and ORB algorithms in parallel and combines their outputs
 * into a unified decision using a weighted scoring system.
 *
 * This module addresses the need for improved recognition accuracy by:
 * - Running multiple algorithms concurrently (non-blocking)
 * - Combining results using a voting/scoring strategy
 * - Providing normalized confidence scores
 * - Tracking performance metrics
 */

import { computeDHash } from './dhash';
import { computePHash } from './phash';
import { hammingDistance } from './hamming';
import { extractORBFeatures, matchORBFeatures } from './orb';
import type { ORBFeatures, ORBConfig } from './orb';
import type { Concert } from '../../../types';

/**
 * Algorithm identifier
 */
export type AlgorithmType = 'dhash' | 'phash' | 'orb';

/**
 * Result from a single recognition algorithm
 */
export interface RecognitionResult {
  algorithm: AlgorithmType;
  similarityScore: number; // Normalized 0-1, where 1 is perfect match
  confidence: number; // Algorithm-specific confidence 0-1
  matchedConcert: Concert | null;
  metadata?: Record<string, unknown>;
  executionTimeMs: number;
}

/**
 * Combined result from all algorithms
 */
export interface ParallelRecognitionResult {
  /** Best matched concert based on combined scoring */
  matchedConcert: Concert | null;
  /** Overall confidence score (0-1) */
  overallConfidence: number;
  /** Individual algorithm results */
  algorithmResults: RecognitionResult[];
  /** Total processing time in ms */
  totalTimeMs: number;
  /** Voting breakdown */
  votingDetails: {
    dhashVote: number;
    phashVote: number;
    orbVote: number;
    combinedScore: number;
  };
}

/**
 * Configuration for parallel recognition
 */
export interface ParallelRecognizerConfig {
  /** Hamming distance threshold for dhash (0-128) */
  dhashThreshold?: number;
  /** Hamming distance threshold for phash (0-64) */
  phashThreshold?: number;
  /** ORB configuration */
  orbConfig?: Partial<ORBConfig>;
  /** Algorithm weights for combined scoring (sum should be 1.0) */
  algorithmWeights?: {
    dhash: number;
    phash: number;
    orb: number;
  };
  /** Minimum overall confidence to consider a match (0-1) */
  minConfidenceThreshold?: number;
}

const DEFAULT_CONFIG: Required<ParallelRecognizerConfig> = {
  dhashThreshold: 24, // ~81% similarity
  phashThreshold: 12, // ~81% similarity
  orbConfig: {
    minMatchCount: 20,
    matchRatioThreshold: 0.75,
  },
  algorithmWeights: {
    dhash: 0.3, // Fast but less robust
    phash: 0.35, // More robust to lighting/angle
    orb: 0.35, // Most robust but slower
  },
  minConfidenceThreshold: 0.6, // Require 60% confidence
};

/**
 * Helper to get photo hashes for a specific algorithm
 */
function getHashesForAlgorithm(concert: Concert, algorithm: 'dhash' | 'phash'): string[] {
  const hashes = concert.photoHashes?.[algorithm];
  if (Array.isArray(hashes) && hashes.length > 0) {
    return hashes;
  }
  // Fallback to legacy photoHash for phash
  if (algorithm === 'phash' && concert.photoHash) {
    return Array.isArray(concert.photoHash) ? concert.photoHash : [concert.photoHash];
  }
  return [];
}

/**
 * Normalize Hamming distance to similarity score (0-1)
 */
function normalizeHashDistance(distance: number, maxDistance: number): number {
  return Math.max(0, Math.min(1, (maxDistance - distance) / maxDistance));
}

/**
 * Run dhash algorithm and find best match
 */
async function runDHash(
  imageData: ImageData,
  concerts: Concert[],
  threshold: number
): Promise<RecognitionResult> {
  const startTime = performance.now();

  try {
    const frameHash = computeDHash(imageData);
    let bestMatch: { concert: Concert; distance: number } | null = null;

    for (const concert of concerts) {
      const hashes = getHashesForAlgorithm(concert, 'dhash');
      if (hashes.length === 0) continue;

      for (const hash of hashes) {
        const distance = hammingDistance(frameHash, hash);
        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = { concert, distance };
        }
      }
    }

    const executionTimeMs = performance.now() - startTime;

    if (!bestMatch || bestMatch.distance > threshold) {
      return {
        algorithm: 'dhash',
        similarityScore: bestMatch ? normalizeHashDistance(bestMatch.distance, 128) : 0,
        confidence: 0,
        matchedConcert: null,
        metadata: { frameHash, bestDistance: bestMatch?.distance ?? -1 },
        executionTimeMs,
      };
    }

    const similarity = normalizeHashDistance(bestMatch.distance, 128);
    // Confidence is higher when distance is lower (closer to 0)
    // Scale from threshold down to 0: confidence = (threshold - distance) / threshold
    const confidence = Math.min(1, (threshold - bestMatch.distance) / threshold);

    return {
      algorithm: 'dhash',
      similarityScore: similarity,
      confidence,
      matchedConcert: bestMatch.concert,
      metadata: { frameHash, distance: bestMatch.distance },
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = performance.now() - startTime;
    console.error('[ParallelRecognizer] dHash error:', error);
    return {
      algorithm: 'dhash',
      similarityScore: 0,
      confidence: 0,
      matchedConcert: null,
      metadata: { error: (error as Error).message },
      executionTimeMs,
    };
  }
}

/**
 * Run phash algorithm and find best match
 */
async function runPHash(
  imageData: ImageData,
  concerts: Concert[],
  threshold: number
): Promise<RecognitionResult> {
  const startTime = performance.now();

  try {
    const frameHash = computePHash(imageData);
    let bestMatch: { concert: Concert; distance: number } | null = null;

    for (const concert of concerts) {
      const hashes = getHashesForAlgorithm(concert, 'phash');
      if (hashes.length === 0) continue;

      for (const hash of hashes) {
        const distance = hammingDistance(frameHash, hash);
        if (!bestMatch || distance < bestMatch.distance) {
          bestMatch = { concert, distance };
        }
      }
    }

    const executionTimeMs = performance.now() - startTime;

    if (!bestMatch || bestMatch.distance > threshold) {
      return {
        algorithm: 'phash',
        similarityScore: bestMatch ? normalizeHashDistance(bestMatch.distance, 64) : 0,
        confidence: 0,
        matchedConcert: null,
        metadata: { frameHash, bestDistance: bestMatch?.distance ?? -1 },
        executionTimeMs,
      };
    }

    const similarity = normalizeHashDistance(bestMatch.distance, 64);
    // Confidence is higher when distance is lower (closer to 0)
    // Scale from threshold down to 0: confidence = (threshold - distance) / threshold
    const confidence = Math.min(1, (threshold - bestMatch.distance) / threshold);

    return {
      algorithm: 'phash',
      similarityScore: similarity,
      confidence,
      matchedConcert: bestMatch.concert,
      metadata: { frameHash, distance: bestMatch.distance },
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = performance.now() - startTime;
    console.error('[ParallelRecognizer] pHash error:', error);
    return {
      algorithm: 'phash',
      similarityScore: 0,
      confidence: 0,
      matchedConcert: null,
      metadata: { error: (error as Error).message },
      executionTimeMs,
    };
  }
}

/**
 * Run ORB algorithm and find best match
 */
async function runORB(
  imageData: ImageData,
  referenceFeatures: Map<number, ORBFeatures>,
  concerts: Concert[],
  config: Partial<ORBConfig>
): Promise<RecognitionResult> {
  const startTime = performance.now();

  try {
    const frameFeatures = extractORBFeatures(imageData, config);
    let bestMatch: { concert: Concert; matchCount: number; confidence: number } | null = null;

    for (const concert of concerts) {
      const refFeatures = referenceFeatures.get(concert.id);
      if (!refFeatures) continue;

      const matchResult = matchORBFeatures(frameFeatures, refFeatures, config);
      if (matchResult.isMatch) {
        if (!bestMatch || matchResult.confidence > bestMatch.confidence) {
          bestMatch = {
            concert,
            matchCount: matchResult.matchCount,
            confidence: matchResult.confidence,
          };
        }
      }
    }

    const executionTimeMs = performance.now() - startTime;

    if (!bestMatch) {
      return {
        algorithm: 'orb',
        similarityScore: 0,
        confidence: 0,
        matchedConcert: null,
        metadata: { keypointCount: frameFeatures.keypoints.length },
        executionTimeMs,
      };
    }

    return {
      algorithm: 'orb',
      similarityScore: bestMatch.confidence,
      confidence: bestMatch.confidence,
      matchedConcert: bestMatch.concert,
      metadata: {
        keypointCount: frameFeatures.keypoints.length,
        matchCount: bestMatch.matchCount,
      },
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = performance.now() - startTime;
    console.error('[ParallelRecognizer] ORB error:', error);
    return {
      algorithm: 'orb',
      similarityScore: 0,
      confidence: 0,
      matchedConcert: null,
      metadata: { error: (error as Error).message },
      executionTimeMs,
    };
  }
}

/**
 * Parallel Photo Recognizer
 *
 * Runs dhash, phash, and ORB algorithms in parallel and combines their results.
 */
export class ParallelPhotoRecognizer {
  private config: Required<ParallelRecognizerConfig>;

  constructor(config?: ParallelRecognizerConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      // Deep merge algorithm weights
      algorithmWeights: {
        ...DEFAULT_CONFIG.algorithmWeights,
        ...(config?.algorithmWeights ?? {}),
      },
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ParallelRecognizerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      // Deep merge algorithm weights
      algorithmWeights: {
        ...this.config.algorithmWeights,
        ...(config.algorithmWeights ?? {}),
      },
    };
  }

  /**
   * Recognize photo using all three algorithms in parallel
   *
   * @param imageData - Frame image data
   * @param concerts - List of concerts to match against
   * @param orbReferenceFeatures - Pre-computed ORB features for reference images
   * @returns Combined recognition result
   */
  public async recognize(
    imageData: ImageData,
    concerts: Concert[],
    orbReferenceFeatures: Map<number, ORBFeatures>
  ): Promise<ParallelRecognitionResult> {
    const overallStartTime = performance.now();

    // Run all three algorithms in parallel
    const [dhashResult, phashResult, orbResult] = await Promise.all([
      runDHash(imageData, concerts, this.config.dhashThreshold),
      runPHash(imageData, concerts, this.config.phashThreshold),
      runORB(imageData, orbReferenceFeatures, concerts, this.config.orbConfig),
    ]);

    const algorithmResults = [dhashResult, phashResult, orbResult];

    // Combine results using weighted voting
    const votingDetails = this.combineResults(dhashResult, phashResult, orbResult);

    // Determine final match
    const matchedConcert = this.selectBestMatch(dhashResult, phashResult, orbResult, votingDetails);

    const totalTimeMs = performance.now() - overallStartTime;

    return {
      matchedConcert,
      overallConfidence: votingDetails.combinedScore,
      algorithmResults,
      totalTimeMs,
      votingDetails,
    };
  }

  /**
   * Combine results from all algorithms using weighted voting
   */
  private combineResults(
    dhashResult: RecognitionResult,
    phashResult: RecognitionResult,
    orbResult: RecognitionResult
  ): ParallelRecognitionResult['votingDetails'] {
    const weights = this.config.algorithmWeights;

    // Calculate weighted votes
    const dhashVote = dhashResult.confidence * weights.dhash;
    const phashVote = phashResult.confidence * weights.phash;
    const orbVote = orbResult.confidence * weights.orb;

    // Combined score is the weighted sum
    const combinedScore = dhashVote + phashVote + orbVote;

    return {
      dhashVote,
      phashVote,
      orbVote,
      combinedScore,
    };
  }

  /**
   * Select the best match based on combined scoring
   */
  private selectBestMatch(
    dhashResult: RecognitionResult,
    phashResult: RecognitionResult,
    orbResult: RecognitionResult,
    votingDetails: ParallelRecognitionResult['votingDetails']
  ): Concert | null {
    // If combined confidence is below threshold, no match
    if (votingDetails.combinedScore < this.config.minConfidenceThreshold) {
      return null;
    }

    // Count votes for each concert
    const concertVotes = new Map<number, { concert: Concert; score: number; votes: number }>();

    const addVote = (result: RecognitionResult, voteWeight: number) => {
      if (!result.matchedConcert) return;

      const existing = concertVotes.get(result.matchedConcert.id);
      if (existing) {
        existing.score += voteWeight;
        existing.votes += 1;
      } else {
        concertVotes.set(result.matchedConcert.id, {
          concert: result.matchedConcert,
          score: voteWeight,
          votes: 1,
        });
      }
    };

    addVote(dhashResult, votingDetails.dhashVote);
    addVote(phashResult, votingDetails.phashVote);
    addVote(orbResult, votingDetails.orbVote);

    if (concertVotes.size === 0) {
      return null;
    }

    // Select concert with highest weighted score
    let bestMatch: { concert: Concert; score: number } | null = null;

    for (const { concert, score } of concertVotes.values()) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { concert, score };
      }
    }

    return bestMatch?.concert ?? null;
  }
}
