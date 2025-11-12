import type { GalleryLayoutProps } from './types';
import styles from './GalleryLayout.module.css';

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
      <div className={styles.landing}>
        <div className={styles.landingContent}>
          <h1 className={styles.landingTitle}>
            Photo Signal
          </h1>
          <p className={styles.landingSubtitle}>
            Point your camera at a photograph to hear its story
          </p>
          <p className={styles.landingDescription}>
            Each photo holds a memory, a moment in time. Let the music take you back.
          </p>
          <button
            onClick={onActivate}
            aria-label="Activate camera and begin experience"
            className={styles.beginButton}
          >
            Begin
          </button>
        </div>
      </div>
    );
  }

  // Active Gallery View with Camera
  return (
    <div className={styles.active}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Photo Signal</h1>
        <p className={styles.headerSubtitle}>Point at a photo to begin</p>
      </div>

      {/* Main Content Area - Camera and Info */}
      <div className={styles.content}>
        {/* Camera View - Takes up main space */}
        <div className={styles.cameraSection}>{cameraView}</div>

        {/* Info Display - Side panel on desktop, below on mobile */}
        <div className={styles.infoSection}>{infoDisplay}</div>
      </div>
    </div>
  );
}
