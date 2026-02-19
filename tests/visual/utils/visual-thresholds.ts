export const VISUAL_MAX_DIFF_RATIO_DEFAULT = 0.03;
export const VISUAL_MAX_DIFF_RATIO_LENIENT = 0.05;

export function getMaxDiffPixelRatio(
  projectName: string,
  overrides: Partial<Record<string, number>> = {},
  defaultRatio = VISUAL_MAX_DIFF_RATIO_DEFAULT
): number {
  return overrides[projectName] ?? defaultRatio;
}
