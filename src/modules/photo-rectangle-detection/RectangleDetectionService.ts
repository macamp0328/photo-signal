/**
 * Rectangle Detection Service
 *
 * Detects rectangular regions (printed photos) in camera frames using
 * edge detection and contour approximation.
 */

import type {
  DetectedRectangle,
  RectangleDetectionResult,
  RectangleDetectionOptions,
} from './types';

/**
 * Default configuration for rectangle detection
 */
const DEFAULT_OPTIONS: Required<RectangleDetectionOptions> = {
  minArea: 0.05, // 5% of frame (reduced to detect smaller photos)
  maxArea: 0.9, // 90% of frame
  minAspectRatio: 0.4, // More lenient for portrait photos
  maxAspectRatio: 3.0, // More lenient for landscape photos
  cannyHighThreshold: 100, // Reduced for better edge detection in varied lighting
  minConfidence: 0.4, // Reduced to allow more detections
};

/**
 * Confidence scoring constants
 * These values were empirically tuned for real-world printed photo detection.
 */
// Weight given to area-based confidence. Set to 0.4 after testing to balance detection of both small and large photos.
const CONFIDENCE_BASE_WEIGHT = 0.4;
// Minimum confidence for any detection. Set to 0.3 to filter out most false positives while allowing edge cases.
const CONFIDENCE_BASE_OFFSET = 0.3;
// Weight given to aspect ratio matching. Set to 0.5 to prioritize rectangular shapes typical of printed photos.
const CONFIDENCE_ASPECT_WEIGHT = 0.5;
// Minimum rectangularity contribution. Set to 0.7 to require strong rectangularity for high confidence.
const CONFIDENCE_RECTANGULARITY_MIN = 0.7;
// Range for rectangularity scoring. Set to 0.3 to allow some tolerance for imperfect edges in real photos.
const CONFIDENCE_RECTANGULARITY_RANGE = 0.3;

/**
 * Rectangularity measurement constants
 *
 * A perfect rectangle has all interior angles at 90° (total deviation = 0).
 * To accommodate perspective distortion from camera angles, we allow up to
 * 30° average deviation per corner (4 corners × 30° = 120° total).
 * This threshold rejects severely non-rectangular shapes while accepting
 * rectangles that may appear skewed due to camera perspective.
 */
const MAX_ANGLE_DEVIATION_DEGREES = 120;

/**
 * Point in 2D space
 */
interface Point {
  x: number;
  y: number;
}

/**
 * Contour represented as array of points
 */
type Contour = Point[];

/**
 * Rectangle Detection Service
 *
 * Provides computer vision-based rectangle detection for identifying
 * printed photographs in camera frames.
 */
export class RectangleDetectionService {
  private options: Required<RectangleDetectionOptions>;

  constructor(options: RectangleDetectionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Detect rectangle in image data
   *
   * @param imageData - Image data from canvas
   * @returns Detection result with rectangle coordinates (if found)
   */
  public detectRectangle(imageData: ImageData): RectangleDetectionResult {
    try {
      // Convert to grayscale
      const grayData = this.toGrayscale(imageData);

      // Enhance contrast to make edges more prominent
      const enhanced = this.enhanceContrast(grayData);

      // Apply Gaussian blur to reduce noise
      const blurred = this.gaussianBlur(enhanced, imageData.width, imageData.height);

      // Detect edges using Sobel operator (simplified Canny)
      const edges = this.detectEdges(blurred, imageData.width, imageData.height);

      // Apply morphological closing to connect broken edges
      const closed = this.morphologicalClose(edges, imageData.width, imageData.height);

      // Find contours in edge-detected image
      const contours = this.findContours(closed, imageData.width, imageData.height);

      // Filter and score contours
      const candidates = this.filterRectangularContours(
        contours,
        imageData.width,
        imageData.height
      );

      if (candidates.length === 0) {
        return {
          rectangle: null,
          confidence: 0,
          detected: false,
          timestamp: Date.now(),
        };
      }

      // Select best candidate
      const best = candidates[0];

      // Normalize coordinates to 0-1 range
      const rectangle = this.normalizeRectangle(best.rectangle, imageData.width, imageData.height);

      return {
        rectangle,
        confidence: best.confidence,
        detected: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[Rectangle Detection] Error detecting rectangle:', error);
      return {
        rectangle: null,
        confidence: 0,
        detected: false,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Convert image data to grayscale
   */
  private toGrayscale(imageData: ImageData): Uint8ClampedArray {
    const gray = new Uint8ClampedArray(imageData.width * imageData.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // ITU-R BT.601 luma coefficients
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i / 4] = luma;
    }

    return gray;
  }

  /**
   * Enhance contrast using histogram stretching
   */
  private enhanceContrast(gray: Uint8ClampedArray): Uint8ClampedArray {
    // Find min and max values
    let min = 255;
    let max = 0;

    for (let i = 0; i < gray.length; i++) {
      if (gray[i] < min) min = gray[i];
      if (gray[i] > max) max = gray[i];
    }

    // Avoid division by zero
    if (max === min) {
      return gray;
    }

    // Stretch histogram to full range
    const enhanced = new Uint8ClampedArray(gray.length);
    const range = max - min;

    for (let i = 0; i < gray.length; i++) {
      enhanced[i] = ((gray[i] - min) * 255) / range;
    }

    return enhanced;
  }

  /**
   * Apply Gaussian blur (3x3 kernel)
   */
  private gaussianBlur(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const blurred = new Uint8ClampedArray(width * height);

    // Gaussian kernel 3x3
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    const kernelSum = 16;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;

        // Apply 3x3 kernel
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            sum += gray[idx] * kernel[kernelIdx];
          }
        }

        blurred[y * width + x] = sum / kernelSum;
      }
    }

    return blurred;
  }

  /**
   * Detect edges using Sobel operator
   */
  private detectEdges(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const edges = new Uint8ClampedArray(width * height);

    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        // Apply Sobel kernels
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            const pixel = gray[idx];

            gx += pixel * sobelX[kernelIdx];
            gy += pixel * sobelY[kernelIdx];
          }
        }

        // Gradient magnitude
        const magnitude = Math.sqrt(gx * gx + gy * gy);

        // Threshold (simplified Canny)
        edges[y * width + x] = magnitude > this.options.cannyHighThreshold ? 255 : 0;
      }
    }

    return edges;
  }

  /**
   * Apply morphological closing to connect broken edges
   * Uses 3x3 kernel for dilation followed by erosion
   * This is a basic morphological closing operation
   */
  private morphologicalClose(
    edges: Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8ClampedArray {
    // Dilate to connect nearby edges
    const dilated = this.dilate(edges, width, height);
    // Erode to restore approximate size
    const eroded = this.erode(dilated, width, height);
    return eroded;
  }

  /**
   * Dilation operation - expand white regions
   */
  private dilate(edges: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let max = 0;

        // Check 3x3 neighborhood
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = (y + dy) * width + (x + dx);
            if (edges[idx] > max) {
              max = edges[idx];
            }
          }
        }

        result[y * width + x] = max;
      }
    }

    return result;
  }

  /**
   * Erosion operation - shrink white regions
   */
  private erode(edges: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let min = 255;

        // Check 3x3 neighborhood
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = (y + dy) * width + (x + dx);
            if (edges[idx] < min) {
              min = edges[idx];
            }
          }
        }

        result[y * width + x] = min;
      }
    }

    return result;
  }

  /**
   * Find contours in edge-detected image (simplified algorithm)
   */
  private findContours(edges: Uint8ClampedArray, width: number, height: number): Contour[] {
    const contours: Contour[] = [];
    const visited = new Uint8ClampedArray(width * height);

    // Simple contour tracing
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        if (edges[idx] === 255 && visited[idx] === 0) {
          const contour = this.traceContour(edges, visited, width, height, x, y);

          if (contour.length >= 4) {
            // Need at least 4 points for a quadrilateral
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  }

  /**
   * Trace a single contour starting from (x, y)
   */
  private traceContour(
    edges: Uint8ClampedArray,
    visited: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number
  ): Contour {
    const contour: Point[] = [];
    const stack: Point[] = [{ x: startX, y: startY }];

    while (stack.length > 0) {
      const point = stack.pop()!;
      const idx = point.y * width + point.x;

      if (visited[idx] === 1) continue;

      visited[idx] = 1;
      contour.push(point);

      // Check 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const nx = point.x + dx;
          const ny = point.y + dy;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;

            if (edges[nidx] === 255 && visited[nidx] === 0) {
              stack.push({ x: nx, y: ny });
            }
          }
        }
      }
    }

    return contour;
  }

  /**
   * Filter contours to find rectangular shapes
   */
  private filterRectangularContours(
    contours: Contour[],
    width: number,
    height: number
  ): Array<{ rectangle: DetectedRectangle; confidence: number }> {
    const candidates: Array<{ rectangle: DetectedRectangle; confidence: number }> = [];

    for (const contour of contours) {
      // Approximate contour to polygon
      const approx = this.approximatePolygon(contour);

      // Must be quadrilateral (4 corners)
      if (approx.length !== 4) continue;

      // Calculate area and aspect ratio
      const rect = this.calculateBoundingBox(approx);
      const area = (rect.width * rect.height) / (width * height);

      // Filter by area
      if (area < this.options.minArea || area > this.options.maxArea) continue;

      // Filter by aspect ratio
      if (
        rect.aspectRatio < this.options.minAspectRatio ||
        rect.aspectRatio > this.options.maxAspectRatio
      )
        continue;

      // Calculate confidence based on rectangularity
      const confidence = this.calculateConfidence(approx, rect, area);

      if (confidence >= this.options.minConfidence) {
        candidates.push({ rectangle: rect, confidence });
      }
    }

    // Sort by confidence (highest first)
    candidates.sort((a, b) => b.confidence - a.confidence);

    return candidates;
  }

  /**
   * Approximate polygon using improved corner detection
   * Finds the 4 corners that best represent a rectangle
   */
  private approximatePolygon(contour: Contour): Contour {
    if (contour.length <= 4) return contour;

    // Method 1: Find extreme points (fastest, works well for axis-aligned rectangles)
    const extremeCorners = this.findExtremeCorners(contour);

    // Method 2: Use convex hull + Douglas-Peucker for better accuracy
    const hull = this.convexHull(contour);
    if (hull.length === 4) {
      return hull;
    }

    // If hull has more than 4 points, simplify it
    if (hull.length > 4) {
      const simplified = this.douglasPeucker(hull, this.calculatePerimeter(hull) * 0.02);
      if (simplified.length === 4) {
        return simplified;
      }
      // If simplification didn't give us 4 points, fall back to extreme corners
    }

    return extremeCorners;
  }

  /**
   * Find the 4 extreme corner points
   */
  private findExtremeCorners(contour: Contour): Contour {
    let minSum = Infinity,
      maxSum = -Infinity;
    let minDiff = Infinity,
      maxDiff = -Infinity;
    let topLeft: Point = { x: 0, y: 0 };
    let topRight: Point = { x: 0, y: 0 };
    let bottomLeft: Point = { x: 0, y: 0 };
    let bottomRight: Point = { x: 0, y: 0 };

    for (const point of contour) {
      const sum = point.x + point.y;
      const diff = point.x - point.y;

      if (sum < minSum) {
        minSum = sum;
        topLeft = point;
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        topRight = point;
      }
      if (sum > maxSum) {
        maxSum = sum;
        bottomRight = point;
      }
      if (diff < minDiff) {
        minDiff = diff;
        bottomLeft = point;
      }
    }

    return [topLeft, topRight, bottomRight, bottomLeft];
  }

  /**
   * Calculate perimeter of a polygon
   */
  private calculatePerimeter(points: Contour): number {
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter;
  }

  /**
   * Compute convex hull using Graham scan
   */
  private convexHull(points: Contour): Contour {
    if (points.length < 3) return points;

    // Find the point with the lowest y-coordinate (and leftmost if tie)
    let lowest = points[0];
    for (const p of points) {
      if (p.y < lowest.y || (p.y === lowest.y && p.x < lowest.x)) {
        lowest = p;
      }
    }

    // Sort points by polar angle with respect to lowest point
    const sorted = points.slice().sort((a, b) => {
      if (a === lowest) return -1;
      if (b === lowest) return 1;

      const angleA = Math.atan2(a.y - lowest.y, a.x - lowest.x);
      const angleB = Math.atan2(b.y - lowest.y, b.x - lowest.x);

      if (angleA !== angleB) {
        return angleA - angleB;
      }

      // If angles are equal, sort by distance
      const distA = (a.x - lowest.x) ** 2 + (a.y - lowest.y) ** 2;
      const distB = (b.x - lowest.x) ** 2 + (b.y - lowest.y) ** 2;
      return distA - distB;
    });

    const hull: Contour = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      // Remove points that make clockwise turn
      while (
        hull.length > 1 &&
        this.crossProduct(hull[hull.length - 2], hull[hull.length - 1], sorted[i]) <= 0
      ) {
        hull.pop();
      }
      hull.push(sorted[i]);
    }

    return hull;
  }

  /**
   * Cross product of vectors (p1->p2) and (p1->p3)
   * Positive if counter-clockwise, negative if clockwise
   */
  private crossProduct(p1: Point, p2: Point, p3: Point): number {
    return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  }

  /**
   * Douglas-Peucker algorithm for polygon simplification
   */
  private douglasPeucker(points: Contour, epsilon: number): Contour {
    if (points.length < 3) return points;

    // Find the point with maximum distance from line between first and last points
    let maxDist = 0;
    let maxIndex = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.perpendicularDistance(points[i], points[0], points[points.length - 1]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (maxDist > epsilon) {
      const left = this.douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
      const right = this.douglasPeucker(points.slice(maxIndex), epsilon);

      // Concatenate results, removing duplicate point at junction
      return left.slice(0, -1).concat(right);
    } else {
      // If no point is far enough, return just the endpoints
      return [points[0], points[points.length - 1]];
    }
  }

  /**
   * Calculate perpendicular distance from point to line
   */
  private perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    // If line is a point, return distance to that point
    if (dx === 0 && dy === 0) {
      return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    }

    // Calculate perpendicular distance using cross product formula
    const numerator = Math.abs(
      dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
    );
    const denominator = Math.sqrt(dx * dx + dy * dy);

    return numerator / denominator;
  }

  /**
   * Calculate bounding box from 4 corner points
   */
  private calculateBoundingBox(points: Contour): DetectedRectangle {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX;
    const height = maxY - minY;

    // Guard against division by zero (degenerate rectangle)
    if (height === 0) {
      return {
        topLeft: { x: minX, y: minY },
        topRight: { x: maxX, y: minY },
        bottomRight: { x: maxX, y: maxY },
        bottomLeft: { x: minX, y: maxY },
        width,
        height,
        aspectRatio: 0,
      };
    }

    return {
      topLeft: { x: minX, y: minY },
      topRight: { x: maxX, y: minY },
      bottomRight: { x: maxX, y: maxY },
      bottomLeft: { x: minX, y: maxY },
      width,
      height,
      aspectRatio: width / height,
    };
  }

  /**
   * Calculate confidence score for detected rectangle
   */
  private calculateConfidence(
    approx: Contour,
    rect: DetectedRectangle,
    normalizedArea: number
  ): number {
    // Base confidence on area (prefer medium to large rectangles)
    // Use a gentler curve that doesn't penalize smaller photos as much
    let confidence =
      Math.min(normalizedArea / 0.3, 1.0) * CONFIDENCE_BASE_WEIGHT + CONFIDENCE_BASE_OFFSET;

    // Penalize extreme aspect ratios, but be more lenient
    // Common photo aspect ratios: 3:2 (1.5), 4:3 (1.33), 16:9 (1.78), 1:1 (1.0)
    const aspectRatioDev = Math.min(
      Math.abs(rect.aspectRatio - 1.5), // Distance from 3:2
      Math.abs(rect.aspectRatio - 1.33), // Distance from 4:3
      Math.abs(rect.aspectRatio - 1.0) // Distance from square
    );

    // Floor aspect ratio contribution at CONFIDENCE_ASPECT_WEIGHT (0.5)
    // This means even worst-case aspect ratio reduces confidence by max 50%
    const aspectContribution = Math.max(CONFIDENCE_ASPECT_WEIGHT, 1 - aspectRatioDev / 3);
    confidence *= aspectContribution;

    // Bonus for rectangularity (check if angles are close to 90 degrees)
    const rectangularity = this.measureRectangularity(approx);
    confidence *= CONFIDENCE_RECTANGULARITY_MIN + rectangularity * CONFIDENCE_RECTANGULARITY_RANGE;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Measure how rectangular the shape is (0-1)
   * More lenient scoring for real-world photos
   */
  private measureRectangularity(points: Contour): number {
    if (points.length !== 4) return 0;

    // Calculate angles between consecutive sides
    let angleSum = 0;

    for (let i = 0; i < 4; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % 4];
      const p3 = points[(i + 2) % 4];

      const angle = this.calculateAngle(p1, p2, p3);
      const deviation = Math.abs(angle - 90);
      angleSum += deviation;
    }

    // Perfect rectangle has angleSum = 0, worst case ~360
    // Use a more lenient scoring: allow up to MAX_ANGLE_DEVIATION_DEGREES total deviation
    const rectangularity = 1 - Math.min(angleSum / MAX_ANGLE_DEVIATION_DEGREES, 1);

    return Math.max(0, rectangularity);
  }

  /**
   * Calculate angle between three points (in degrees)
   */
  private calculateAngle(p1: Point, p2: Point, p3: Point): number {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    return (angle * 180) / Math.PI;
  }

  /**
   * Normalize rectangle coordinates to 0-1 range
   */
  private normalizeRectangle(
    rect: DetectedRectangle,
    width: number,
    height: number
  ): DetectedRectangle {
    return {
      topLeft: {
        x: rect.topLeft.x / width,
        y: rect.topLeft.y / height,
      },
      topRight: {
        x: rect.topRight.x / width,
        y: rect.topRight.y / height,
      },
      bottomRight: {
        x: rect.bottomRight.x / width,
        y: rect.bottomRight.y / height,
      },
      bottomLeft: {
        x: rect.bottomLeft.x / width,
        y: rect.bottomLeft.y / height,
      },
      width: rect.width / width,
      height: rect.height / height,
      aspectRatio: rect.aspectRatio,
    };
  }
}
