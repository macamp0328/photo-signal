import type { DetectedRectangle } from '../../photo-rectangle-detection';

interface Point {
  x: number;
  y: number;
}

const MIN_OUTPUT_SIZE = 24;

const getDestinationSize = (corners: [Point, Point, Point, Point]) => {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;

  const topWidth = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
  const bottomWidth = Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y);
  const leftHeight = Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y);
  const rightHeight = Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y);

  const width = Math.max(Math.round(Math.max(topWidth, bottomWidth)), MIN_OUTPUT_SIZE);
  const height = Math.max(Math.round(Math.max(leftHeight, rightHeight)), MIN_OUTPUT_SIZE);

  return { width, height };
};

const solveLinearSystem = (matrix: number[][], values: number[]): number[] | null => {
  const size = values.length;
  const augmented = matrix.map((row, rowIndex) => [...row, values[rowIndex]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    let maxValue = Math.abs(augmented[pivot][pivot]);

    for (let row = pivot + 1; row < size; row += 1) {
      const value = Math.abs(augmented[row][pivot]);
      if (value > maxValue) {
        maxValue = value;
        maxRow = row;
      }
    }

    if (maxValue < 1e-8) {
      return null;
    }

    if (maxRow !== pivot) {
      const tmp = augmented[pivot];
      augmented[pivot] = augmented[maxRow];
      augmented[maxRow] = tmp;
    }

    const pivotValue = augmented[pivot][pivot];
    for (let col = pivot; col <= size; col += 1) {
      augmented[pivot][col] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }

      const factor = augmented[row][pivot];
      for (let col = pivot; col <= size; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  return augmented.map((row) => row[size]);
};

const computeHomography = (
  src: [Point, Point, Point, Point],
  dst: [Point, Point, Point, Point]
) => {
  const matrix: number[][] = [];
  const values: number[] = [];

  for (let i = 0; i < 4; i += 1) {
    const { x: u, y: v } = dst[i];
    const { x, y } = src[i];

    matrix.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    values.push(x);

    matrix.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    values.push(y);
  }

  const solution = solveLinearSystem(matrix, values);
  if (!solution) {
    return null;
  }

  const [h11, h12, h13, h21, h22, h23, h31, h32] = solution;

  return {
    h11,
    h12,
    h13,
    h21,
    h22,
    h23,
    h31,
    h32,
  };
};

const sampleBilinear = (
  imageData: ImageData,
  sourceX: number,
  sourceY: number,
  output: Uint8ClampedArray,
  outputIndex: number
) => {
  const { width, height, data } = imageData;

  const x0 = Math.floor(sourceX);
  const y0 = Math.floor(sourceY);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);

  const wx = sourceX - x0;
  const wy = sourceY - y0;

  const topLeftIndex = (y0 * width + x0) * 4;
  const topRightIndex = (y0 * width + x1) * 4;
  const bottomLeftIndex = (y1 * width + x0) * 4;
  const bottomRightIndex = (y1 * width + x1) * 4;

  for (let channel = 0; channel < 4; channel += 1) {
    const top = data[topLeftIndex + channel] * (1 - wx) + data[topRightIndex + channel] * wx;
    const bottom =
      data[bottomLeftIndex + channel] * (1 - wx) + data[bottomRightIndex + channel] * wx;
    output[outputIndex + channel] = Math.round(top * (1 - wy) + bottom * wy);
  }
};

export const getPerspectiveCroppedImageData = (
  sourceImageData: ImageData,
  rectangle: DetectedRectangle
): ImageData | null => {
  const corners: [Point, Point, Point, Point] = [
    {
      x: rectangle.topLeft.x * sourceImageData.width,
      y: rectangle.topLeft.y * sourceImageData.height,
    },
    {
      x: rectangle.topRight.x * sourceImageData.width,
      y: rectangle.topRight.y * sourceImageData.height,
    },
    {
      x: rectangle.bottomRight.x * sourceImageData.width,
      y: rectangle.bottomRight.y * sourceImageData.height,
    },
    {
      x: rectangle.bottomLeft.x * sourceImageData.width,
      y: rectangle.bottomLeft.y * sourceImageData.height,
    },
  ];

  const { width, height } = getDestinationSize(corners);

  if (width <= 0 || height <= 0) {
    return null;
  }

  const destinationCorners: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];

  const homography = computeHomography(corners, destinationCorners);
  if (!homography) {
    return null;
  }

  const outputData = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const denominator = homography.h31 * x + homography.h32 * y + 1;
      if (Math.abs(denominator) < 1e-8) {
        continue;
      }

      const sourceX = (homography.h11 * x + homography.h12 * y + homography.h13) / denominator;
      const sourceY = (homography.h21 * x + homography.h22 * y + homography.h23) / denominator;

      if (
        sourceX < 0 ||
        sourceX > sourceImageData.width - 1 ||
        sourceY < 0 ||
        sourceY > sourceImageData.height - 1
      ) {
        continue;
      }

      const outputIndex = (y * width + x) * 4;
      sampleBilinear(sourceImageData, sourceX, sourceY, outputData, outputIndex);
    }
  }

  return new ImageData(outputData, width, height);
};
