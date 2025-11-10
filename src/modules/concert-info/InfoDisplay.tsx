import type { InfoDisplayProps } from './types';

/**
 * Concert Info Display Component
 *
 * Pure UI component for displaying concert metadata.
 * Styled as a distinct content block with zine-like aesthetic.
 */
export function InfoDisplay({ concert, isVisible, className = '' }: InfoDisplayProps) {
  if (!concert) return null;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // For the new gallery layout, we use a card-style design
  return (
    <div
      className={`
        bg-white border-2 border-main-text rounded-lg shadow-lg
        p-6 transition-all duration-500
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        ${className}
      `}
    >
      <div className="space-y-3">
        <div className="border-b-2 border-sub-background pb-3">
          <h2 className="text-2xl font-bold text-main-text leading-tight">{concert.band}</h2>
        </div>
        <div className="space-y-2">
          <p className="text-lg text-sub-text font-medium">{concert.venue}</p>
          <p className="text-sm text-bonus-text">{formatDate(concert.date)}</p>
        </div>
        <div className="pt-2 border-t border-sub-background">
          <p className="text-xs text-bonus-text uppercase tracking-wide">Now Playing</p>
        </div>
      </div>
    </div>
  );
}
