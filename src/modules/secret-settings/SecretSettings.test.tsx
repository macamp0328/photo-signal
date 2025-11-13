/**
 * Tests for SecretSettings component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecretSettings } from './SecretSettings';
import userEvent from '@testing-library/user-event';

describe('SecretSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

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

    it('should display feature flags from config', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Psychedelic Color Cycle Mode/i)).toBeInTheDocument();
      expect(screen.getByText(/Old-School Easter Egg Sounds/i)).toBeInTheDocument();
    });

    it('should display custom settings from config', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Theme Mode/i)).toBeInTheDocument();
      expect(screen.getByText(/UI Style/i)).toBeInTheDocument();
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

    it('should display reset buttons', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const resetButtons = screen.getAllByText(/Reset All/i);
      expect(resetButtons.length).toBeGreaterThan(0);
    });

    it('should display feature flag checkboxes', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should display custom setting selects', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });
  });
});
