import type { InfoDisplayProps } from './types';

/**
 * Concert Info Display Component
 *
 * Pure UI component for displaying concert metadata.
 * No side effects, no business logic.
 */
export function InfoDisplay({
  concert,
  isVisible,
  position = 'bottom',
  className = '',
}: InfoDisplayProps) {
  if (!concert || !isVisible) return null;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const positionClasses =
    position === 'top'
      ? 'top-0 bg-gradient-to-b from-black via-black/90 to-transparent'
      : 'bottom-0 bg-gradient-to-t from-black via-black/90 to-transparent';

  return (
    <div
      className={`
        fixed left-0 right-0 
        ${positionClasses}
        p-6 pb-8 
        transition-opacity duration-500 
        ${isVisible ? 'opacity-100' : 'opacity-0'}
        ${className}
      `}
    >
      <div className="max-w-lg mx-auto text-white">
        <h1 className="text-3xl font-bold mb-2 animate-fade-in">{concert.band}</h1>
        <p className="text-xl text-gray-300 mb-1">{concert.venue}</p>
        <p className="text-sm text-gray-400">{formatDate(concert.date)}</p>
      </div>
    </div>
  );
}
