export type RecognitionCropVariantId = 'full' | 'bottom-trim' | 'center-trim';

export interface RecognitionCropVariant {
  id: RecognitionCropVariantId;
  x: number;
  y: number;
  width: number;
  height: number;
}

const BOTTOM_TRIM_FRACTION = 0.22;
const CENTER_TOP_TRIM_FRACTION = 0.08;
const CENTER_BOTTOM_TRIM_FRACTION = 0.18;
const MIN_VARIANT_SIZE = 16;

const clampRegion = (
  id: RecognitionCropVariantId,
  sourceWidth: number,
  sourceHeight: number,
  topTrimFraction: number,
  bottomTrimFraction: number
): RecognitionCropVariant | null => {
  const y = Math.round(sourceHeight * topTrimFraction);
  const bottomTrim = Math.round(sourceHeight * bottomTrimFraction);
  const height = sourceHeight - y - bottomTrim;

  if (sourceWidth < MIN_VARIANT_SIZE || height < MIN_VARIANT_SIZE) {
    return null;
  }

  return {
    id,
    x: 0,
    y,
    width: sourceWidth,
    height,
  };
};

export function getRecognitionCropVariants(
  sourceWidth: number,
  sourceHeight: number,
  demoCropFallbackEnabled: boolean
): RecognitionCropVariant[] {
  const full: RecognitionCropVariant = {
    id: 'full',
    x: 0,
    y: 0,
    width: sourceWidth,
    height: sourceHeight,
  };

  if (!demoCropFallbackEnabled) {
    return [full];
  }

  const variants = [full];
  const bottomTrim = clampRegion('bottom-trim', sourceWidth, sourceHeight, 0, BOTTOM_TRIM_FRACTION);
  const centerTrim = clampRegion(
    'center-trim',
    sourceWidth,
    sourceHeight,
    CENTER_TOP_TRIM_FRACTION,
    CENTER_BOTTOM_TRIM_FRACTION
  );

  if (bottomTrim) {
    variants.push(bottomTrim);
  }

  if (centerTrim) {
    variants.push(centerTrim);
  }

  return variants;
}
