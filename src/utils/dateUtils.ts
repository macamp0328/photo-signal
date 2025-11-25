const CENTRAL_TIME_ZONE = 'America/Chicago';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CENTRAL_TIME_ZONE,
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CENTRAL_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const TIME_ZONE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CENTRAL_TIME_ZONE,
  timeZoneName: 'short',
});

export interface ConcertTimestampFormatOptions {
  /** Include time component when the source value contains time data (default: true) */
  includeTime?: boolean;
  /** Include timezone abbreviation when time is shown (default: true) */
  includeTimeZone?: boolean;
  /** Fallback string when the timestamp cannot be parsed (default: 'Date unavailable') */
  fallback?: string;
}

const DEFAULT_FORMAT_OPTIONS: Required<ConcertTimestampFormatOptions> = {
  includeTime: true,
  includeTimeZone: true,
  fallback: 'Date unavailable',
};

function getTimeZoneName(date: Date): string {
  const parts = TIME_ZONE_FORMATTER.formatToParts(date);
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
}

/**
 * Determine whether a timestamp string includes a time component.
 */
export function hasTimeComponent(value: string): boolean {
  return /T\d{2}:\d{2}/.test(value);
}

/**
 * Parse concert timestamps while respecting America/Chicago semantics.
 */
export function getDateFromConcertTimestamp(value: string): Date | null {
  if (!value) return null;
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const parsed = new Date(trimmedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format concert timestamps consistently for UI and search.
 */
export function formatConcertTimestamp(
  value: string,
  options: ConcertTimestampFormatOptions = {}
): string {
  const mergedOptions = { ...DEFAULT_FORMAT_OPTIONS, ...options };
  const date = getDateFromConcertTimestamp(value);

  if (!date) {
    return mergedOptions.fallback;
  }

  const formattedDate = DATE_FORMATTER.format(date);
  const shouldShowTime =
    mergedOptions.includeTime && hasTimeComponent(value) && !Number.isNaN(date.getTime());

  if (!shouldShowTime) {
    return formattedDate;
  }

  const timeString = TIME_FORMATTER.format(date);
  const zoneString = mergedOptions.includeTimeZone ? getTimeZoneName(date) : '';
  const spacer = zoneString ? ` ${zoneString}` : '';
  return `${formattedDate} at ${timeString}${spacer}`.trim();
}

/**
 * Provide a lower-case representation for search indexing.
 */
export function getTimestampSearchText(value: string): string {
  const formatted = formatConcertTimestamp(value, {
    includeTime: true,
    includeTimeZone: false,
    fallback: '',
  });
  return formatted.toLowerCase();
}

export { CENTRAL_TIME_ZONE };
