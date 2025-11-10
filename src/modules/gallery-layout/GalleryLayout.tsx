import type { GalleryLayoutProps } from './types';

/**
 * Gallery Layout Component
 *
 * Provides a zine-like, curated UI experience with:
 * - Landing view with title and instructions
 * - Integrated camera view (not full-screen)
 * - Asymmetrical, thoughtful layout
 * - Textured background aesthetic
 */
export function GalleryLayout({
  isActive,
  cameraView,
  infoDisplay,
  onActivate,
}: GalleryLayoutProps) {
  if (!isActive) {
    // Landing/Initial View
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
        <div className="max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-bold text-main-text mb-6 leading-tight">
            Photo Signal
          </h1>
          <p className="text-xl md:text-2xl text-sub-text mb-8 leading-relaxed">
            Point your camera at a photograph to hear its story
          </p>
          <p className="text-base md:text-lg text-bonus-text mb-12 max-w-lg mx-auto">
            Each photo holds a memory, a moment in time. Let the music take you back.
          </p>
          <button
            onClick={onActivate}
            aria-label="Activate camera and begin experience"
            className="px-8 py-4 bg-main-text text-white text-lg font-medium rounded-lg
                     hover:bg-sub-text transition-colors duration-300
                     shadow-lg hover:shadow-xl transform hover:-translate-y-0.5
                     transition-all"
          >
            Begin
          </button>
        </div>
      </div>
    );
  }

  // Active Gallery View with Camera
  return (
    <div className="flex flex-col h-screen p-4 md:p-8 gap-6">
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold text-main-text">Photo Signal</h1>
        <p className="text-sm md:text-base text-sub-text mt-1">Point at a photo to begin</p>
      </div>

      {/* Main Content Area - Camera and Info */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        {/* Camera View - Takes up main space */}
        <div className="flex-1 min-h-0">{cameraView}</div>

        {/* Info Display - Side panel on desktop, below on mobile */}
        <div className="flex-shrink-0 md:w-80">{infoDisplay}</div>
      </div>
    </div>
  );
}
