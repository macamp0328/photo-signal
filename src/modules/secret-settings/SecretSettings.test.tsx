/**
 * Tests for SecretSettings component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecretSettings } from './SecretSettings';
import { FeatureFlagProvider } from '../../contexts';
import userEvent from '@testing-library/user-event';

// Helper to render with provider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<FeatureFlagProvider>{ui}</FeatureFlagProvider>);
};

describe('SecretSettings', () => {
  describe('Rendering', () => {
    it('should render when isVisible is true', () => {
      renderWithProvider(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Secret Settings/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Feature Flags/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Custom Settings/i })).toBeInTheDocument();
    });

    it('should not render when isVisible is false', () => {
      renderWithProvider(<SecretSettings isVisible={false} onClose={vi.fn()} />);

      expect(screen.queryByText(/Secret Settings/i)).not.toBeInTheDocument();
    });

    it('should display test data mode toggle', () => {
      renderWithProvider(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Test Data Mode/i)).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Toggle test data mode/i })).toBeInTheDocument();
    });

    it('should display placeholder text for custom settings', () => {
      renderWithProvider(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/No custom settings configured yet/i)).toBeInTheDocument();
    });

    it('should display developer information', () => {
      renderWithProvider(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/For Developers/i)).toBeInTheDocument();
      expect(screen.getByText(/How to add new feature flags/i)).toBeInTheDocument();
      expect(screen.getByText(/How to add custom settings/i)).toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      renderWithProvider(<SecretSettings isVisible={true} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /close settings menu/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      renderWithProvider(<SecretSettings isVisible={true} onClose={onClose} />);

      const overlay = screen.getByRole('dialog');
      await user.click(overlay);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onClose when modal content is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      renderWithProvider(<SecretSettings isVisible={true} onClose={onClose} />);

      const modalContent = screen.getByRole('document');
      await user.click(modalContent);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderWithProvider(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      const document = screen.getByRole('document');
      expect(document).toHaveAttribute('aria-label', 'Secret Settings Menu');
    });

    it('should have accessible close button', () => {
      renderWithProvider(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const closeButton = screen.getByRole('button', { name: /close settings menu/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('type', 'button');
      expect(closeButton).toHaveAttribute('aria-label', 'Close settings menu');
    });
  });

  describe('Content sections', () => {
    it('should display introduction text', () => {
      renderWithProvider(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/activated by triple-tapping in the center of the screen/i)
      ).toBeInTheDocument();
    });

    it('should display mode badge', () => {
      renderWithProvider(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      // Should show production mode by default
      expect(screen.getByText(/Production Mode/i)).toBeInTheDocument();
    });
  });
});
