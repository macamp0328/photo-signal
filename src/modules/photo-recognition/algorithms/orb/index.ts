/**
 * ORB Feature Matching Module
 *
 * Exports feature-based photo matching using ORB (Oriented FAST and Rotated BRIEF)
 */

export {
  extractORBFeatures,
  matchORBFeatures,
  matchImages,
  type ORBKeypoint,
  type ORBDescriptor,
  type ORBFeatures,
  type FeatureMatch,
  type ORBMatchResult,
  type ORBConfig,
} from './orb';
