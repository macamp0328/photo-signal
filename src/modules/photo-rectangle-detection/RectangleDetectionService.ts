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
  minArea: 0.1, // 10% of frame
  maxArea: 0.9, // 90% of frame
  minAspectRatio: 0.5, // 1:2 portrait
  maxAspectRatio: 2.5, // 5:2 landscape
  cannyLowThreshold: 50,
  cannyHighThreshold: 150,
  minConfidence: 0.6,
};

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

      // Apply Gaussian blur to reduce noise
      const blurred = this.gaussianBlur(grayData, imageData.width, imageData.height);

      // Detect edges using Sobel operator (simplified Canny)
      const edges = this.detectEdges(blurred, imageData.width, imageData.height);

      // Find contours in edge-detected image
      const contours = this.findContours(edges, imageData.width, imageData.height);

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
    const contour: Contour[] = [];
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
   * Approximate polygon using Douglas-Peucker algorithm (simplified)
   */
  private approximatePolygon(contour: Contour): Contour {
    if (contour.length <= 4) return contour;

    // Find convex hull (simplified - just get extreme points)
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity;
    let topLeft: Point = { x: 0, y: 0 };
    let topRight: Point = { x: 0, y: 0 };
    let bottomLeft: Point = { x: 0, y: 0 };
    let bottomRight: Point = { x: 0, y: 0 };

    for (const point of contour) {
      if (point.x + point.y < minX + minY) {
        minX = point.x;
        minY = point.y;
        topLeft = point;
      }
      if (point.x - point.y > maxX - bottomRight.y) {
        maxX = point.x;
        topRight = point;
      }
      if (point.y - point.x > bottomLeft.y - minX) {
        bottomLeft = point;
      }
      if (point.x + point.y > bottomRight.x + bottomRight.y) {
        bottomRight = point;
      }
    }

    return [topLeft, topRight, bottomRight, bottomLeft];
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
    // Base confidence on area (prefer larger rectangles)
    let confidence = Math.min(normalizedArea / 0.5, 1.0);

    // Penalize extreme aspect ratios
    const aspectRatioDev = Math.abs(rect.aspectRatio - 1.5);
    confidence *= Math.max(0, 1 - aspectRatioDev / 2);

    // Bonus for rectangularity (check if angles are close to 90 degrees)
    const rectangularity = this.measureRectangularity(approx);
    confidence *= rectangularity;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Measure how rectangular the shape is (0-1)
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
    const rectangularity = 1 - Math.min(angleSum / 180, 1);

    return rectangularity;
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
