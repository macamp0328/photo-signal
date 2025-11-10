import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SecretMenu } from './SecretMenu';

describe('SecretMenu', () => {
  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(<SecretMenu isOpen={false} onClose={vi.fn()} />);
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText('⚙️ Developer Settings')).toBeTruthy();
    });

    it('should render feature flags section', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('🚩 Feature Flags')).toBeTruthy();
      const comingSoonBadges = screen.getAllByText(/Coming Soon/i);
      expect(comingSoonBadges.length).toBeGreaterThan(0);
    });

    it('should render custom settings section', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('🎛️ Custom Settings')).toBeTruthy();
    });

    it('should render help text for developers', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('📚 For Developers')).toBeTruthy();
      expect(screen.getByText(/triple-tapping/i)).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<SecretMenu isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: 'Close menu' });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Close button in footer is clicked', () => {
      const onClose = vi.fn();
      render(<SecretMenu isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<SecretMenu isOpen={true} onClose={onClose} />);

      // Find the backdrop (the fixed div with bg-black)
      const backdrop = container.querySelector('.fixed.bg-black');
      expect(backdrop).toBeTruthy();

      fireEvent.click(backdrop as Element);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('secret-menu-title');
    });

    it('should have close button with aria-label', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const closeButton = screen.getByRole('button', { name: 'Close menu' });
      expect(closeButton).toBeTruthy();
    });

    it('should have backdrop with aria-hidden', () => {
      const { container } = render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const backdrop = container.querySelector('.fixed.bg-black');
      expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Content', () => {
    it('should display placeholder text for feature flags', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/No feature flags configured yet/i)
      ).toBeTruthy();
      // Use getAllBy since there are multiple matches
      const readmeRefs = screen.getAllByText(/See README.md for implementation guide/i);
      expect(readmeRefs.length).toBeGreaterThan(0);
    });

    it('should display placeholder text for custom settings', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/No custom settings configured yet/i)
      ).toBeTruthy();
    });

    it('should display instructions about activation', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/activated by triple-tapping in the center of the screen/i)
      ).toBeTruthy();
    });

    it('should reference the README documentation', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const codeElement = screen.getByText(/src\/modules\/secret-menu\/README.md/i);
      expect(codeElement).toBeTruthy();
      expect(codeElement.tagName.toLowerCase()).toBe('code');
    });
  });

  describe('Styling', () => {
    it('should have z-index higher than backdrop', () => {
      const { container } = render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const backdrop = container.querySelector('.z-40');
      const modal = container.querySelector('.z-50');

      expect(backdrop).toBeTruthy();
      expect(modal).toBeTruthy();
    });

    it('should have responsive classes', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('md:');
    });

    it('should have scrollable content area', () => {
      const { container } = render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const contentArea = container.querySelector('.overflow-y-auto');
      expect(contentArea).toBeTruthy();
    });
  });
});
