/**
 * Tests for PsychedelicEffect component
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PsychedelicEffect } from './PsychedelicEffect';

describe('PsychedelicEffect', () => {
  describe('Rendering', () => {
    it('should not render when disabled', () => {
      const { container } = render(<PsychedelicEffect enabled={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render overlay when enabled', () => {
      const { container } = render(<PsychedelicEffect enabled={true} />);
      expect(container.firstChild).toBeTruthy();
      // Check for CSS Module class (will be hashed like _overlay_xyz123)
      const className = (container.firstChild as HTMLElement).className;
      expect(className).toContain('overlay');
    });

    it('should render multiple gradient layers', () => {
      const { container } = render(<PsychedelicEffect enabled={true} />);
      const gradients = container.querySelectorAll('[class*="gradient"]');
      expect(gradients.length).toBeGreaterThan(0);
    });

    it('should render pulse effects', () => {
      const { container } = render(<PsychedelicEffect enabled={true} />);
      const pulses = container.querySelectorAll('[class*="pulse"]');
      expect(pulses.length).toBeGreaterThan(0);
    });
  });

  describe('Behavior', () => {
    it('should have pointer-events: none to avoid blocking interaction', () => {
      const { container } = render(<PsychedelicEffect enabled={true} />);
      const overlay = container.firstChild as HTMLElement;
      const styles = window.getComputedStyle(overlay);
      expect(styles.pointerEvents).toBe('none');
    });
  });
});
