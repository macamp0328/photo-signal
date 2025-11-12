/**
 * Tests for SecretSettings component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecretSettings } from './SecretSettings';
import userEvent from '@testing-library/user-event';

describe('SecretSettings', () => {
  describe('Rendering', () => {
    it('should render when isVisible is true', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Secret Settings/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Feature Flags/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Custom Settings/i })).toBeInTheDocument();
    });

    it('should not render when isVisible is false', () => {
      render(<SecretSettings isVisible={false} onClose={vi.fn()} />);

      expect(screen.queryByText(/Secret Settings/i)).not.toBeInTheDocument();
    });

    it('should display placeholder text for feature flags', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/No feature flags configured yet/i)).toBeInTheDocument();
    });

    it('should display placeholder text for custom settings', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/No custom settings configured yet/i)).toBeInTheDocument();
    });

    it('should display developer information', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/For Developers/i)).toBeInTheDocument();
      expect(screen.getByText(/How to add new feature flags/i)).toBeInTheDocument();
      expect(screen.getByText(/How to add custom settings/i)).toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<SecretSettings isVisible={true} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /close settings menu/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<SecretSettings isVisible={true} onClose={onClose} />);

      const overlay = screen.getByRole('dialog');
      await user.click(overlay);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onClose when modal content is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<SecretSettings isVisible={true} onClose={onClose} />);

      const modalContent = screen.getByRole('document');
      await user.click(modalContent);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      const document = screen.getByRole('document');
      expect(document).toHaveAttribute('aria-label', 'Secret Settings Menu');
    });

    it('should have accessible close button', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const closeButton = screen.getByRole('button', { name: /close settings menu/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('type', 'button');
      expect(closeButton).toHaveAttribute('aria-label', 'Close settings menu');
    });
  });

  describe('Content sections', () => {
    it('should display introduction text', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/activated by triple-tapping in the center of the screen/i)
      ).toBeInTheDocument();
    });

    it('should display hint text for adding features', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const hints = screen.getAllByText(/See the module README for instructions/i);
      expect(hints.length).toBeGreaterThan(0);
    });
  });
});
