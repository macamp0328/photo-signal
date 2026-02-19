/**
 * Tests for SecretSettings component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    });

    it('should not render when isVisible is false', () => {
      render(<SecretSettings isVisible={false} onClose={vi.fn()} />);

      expect(screen.queryByText(/Secret Settings/i)).not.toBeInTheDocument();
    });

    it('should display feature flags from config', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Test Data Mode/i)).toBeInTheDocument();
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
      expect(dialog).toHaveAttribute(
        'aria-describedby',
        'secret-settings-intro-description secret-settings-mode-status'
      );

      const document = screen.getByRole('document');
      expect(document).toHaveAttribute('aria-label', 'Secret Settings Menu');
    });

    it('should expose intro and mode status with stable IDs for assistive tech', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/opens with a triple tap in the center of the screen/i)
      ).toHaveAttribute('id', 'secret-settings-intro-description');

      const modeBadge = screen.getByText(/production mode/i);
      expect(modeBadge).toHaveAttribute('id', 'secret-settings-mode-status');
      expect(modeBadge).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible close button', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const closeButton = screen.getByRole('button', { name: /close settings menu/i });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('type', 'button');
      expect(closeButton).toHaveAttribute('aria-label', 'Close settings menu');
    });

    it('should close when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<SecretSettings isVisible={true} onClose={onClose} />);

      const overlay = screen.getByRole('dialog');
      fireEvent.keyDown(overlay, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should focus close button on open', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const closeButton = screen.getByRole('button', { name: /close settings menu/i });
      expect(closeButton).toHaveFocus();
    });

    it('should trap Tab focus inside the modal', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      const modalContent = screen.getByRole('document');
      const focusableElements = Array.from(
        modalContent.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      lastElement.focus();
      fireEvent.keyDown(dialog, { key: 'Tab' });
      expect(firstElement).toHaveFocus();

      firstElement.focus();
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
      expect(lastElement).toHaveFocus();
    });

    it('should restore focus to previously focused element when closing', async () => {
      const { rerender } = render(
        <>
          <button type="button">Launch Settings</button>
          <SecretSettings isVisible={false} onClose={vi.fn()} />
        </>
      );

      const launchButton = screen.getByRole('button', { name: /launch settings/i });
      launchButton.focus();

      rerender(
        <>
          <button type="button">Launch Settings</button>
          <SecretSettings isVisible={true} onClose={vi.fn()} />
        </>
      );

      expect(screen.getByRole('button', { name: /close settings menu/i })).toHaveFocus();

      rerender(
        <>
          <button type="button">Launch Settings</button>
          <SecretSettings isVisible={false} onClose={vi.fn()} />
        </>
      );

      await waitFor(() => {
        expect(launchButton).toHaveFocus();
      });
    });
  });

  describe('Content sections', () => {
    it('should display introduction text', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/opens with a triple tap in the center of the screen/i)
      ).toBeInTheDocument();
    });

    it('should associate feature flags section description for screen readers', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const featureFlagsHeading = screen.getByRole('heading', { name: /feature flags/i });
      const featureFlagsSection = featureFlagsHeading.closest('section');
      expect(featureFlagsSection).toHaveAttribute('aria-describedby', 'feature-flags-description');
      expect(
        screen.getByText(/toggle feature flags used for experiments and troubleshooting/i)
      ).toHaveAttribute('id', 'feature-flags-description');
    });

    it('should display feature flag checkboxes', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should display mode badge', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      // Should show production mode by default (test-mode flag is off by default)
      expect(screen.getByText(/Production Mode/i)).toBeInTheDocument();
    });
  });

  describe('Send It Button', () => {
    it('should render Save & Reload button', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);
      expect(screen.getByText(/Save & Reload/i)).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      const button = screen.getByRole('button', {
        name: /Save & Reload - Apply changes and reload page/i,
      });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-label', 'Save & Reload - Apply changes and reload page');
    });

    it('should call onClose when Save & Reload is clicked', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(<SecretSettings isVisible={true} onClose={handleClose} />);

      const button = screen.getByText(/Save & Reload/i);
      await user.click(button);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('should reload page after clicking Save & Reload', async () => {
      const user = userEvent.setup();
      const reloadSpy = vi.fn();
      const originalLocation = window.location;

      try {
        // Mock window.location.reload
        delete (window as { location?: unknown }).location;
        (window as { location: unknown }).location = { ...originalLocation, reload: reloadSpy };

        render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

        const button = screen.getByText(/Save & Reload/i);
        await user.click(button);

        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(reloadSpy).toHaveBeenCalled();
      } finally {
        // Restore
        (window as { location: unknown }).location = originalLocation;
      }
    });

    it('should display descriptive helper text', () => {
      render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/Settings save instantly\. Reload applies runtime-only changes\./i)
      ).toBeInTheDocument();
    });

    it('should call onClose before scheduling page reload', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      const reloadSpy = vi.fn();
      const originalLocation = window.location;

      try {
        delete (window as { location?: unknown }).location;
        (window as { location: unknown }).location = { ...originalLocation, reload: reloadSpy };

        render(<SecretSettings isVisible={true} onClose={handleClose} />);

        const button = screen.getByText(/Save & Reload/i);
        await user.click(button);

        // onClose should be called immediately (before reload timeout)
        expect(handleClose).toHaveBeenCalledTimes(1);
        expect(reloadSpy).not.toHaveBeenCalled();

        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(reloadSpy).toHaveBeenCalled();
      } finally {
        (window as { location: unknown }).location = originalLocation;
      }
    });

    it('should reload page even if component unmounts after Save & Reload is clicked', async () => {
      const user = userEvent.setup();
      const reloadSpy = vi.fn();
      const originalLocation = window.location;

      try {
        delete (window as { location?: unknown }).location;
        (window as { location: unknown }).location = { ...originalLocation, reload: reloadSpy };

        const { unmount } = render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

        const button = screen.getByText(/Save & Reload/i);
        await user.click(button);

        // Unmount immediately after clicking (simulates parent setting isVisible={false})
        unmount();

        await new Promise((resolve) => setTimeout(resolve, 150));

        // Reload should still be called even though component was unmounted
        expect(reloadSpy).toHaveBeenCalled();
      } finally {
        (window as { location: unknown }).location = originalLocation;
      }
    });

    it('should persist feature flag changes before reload', async () => {
      const user = userEvent.setup();
      const reloadSpy = vi.fn();
      const originalLocation = window.location;

      try {
        delete (window as { location?: unknown }).location;
        (window as { location: unknown }).location = { ...originalLocation, reload: reloadSpy };

        render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

        // Toggle a feature flag
        const testModeCheckbox = screen.getByRole('checkbox', { name: /test data mode/i });
        await user.click(testModeCheckbox);

        // Click Save & Reload
        const button = screen.getByText(/Save & Reload/i);
        await user.click(button);

        // Check that the change was persisted to localStorage before reload
        const saved = localStorage.getItem('photo-signal-feature-flags');
        expect(saved).toBeTruthy();
        const flags = JSON.parse(saved!);
        const testModeFlag = flags.find((f: { id: string }) => f.id === 'test-mode');
        expect(testModeFlag?.enabled).toBe(true);

        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(reloadSpy).toHaveBeenCalled();
      } finally {
        (window as { location: unknown }).location = originalLocation;
      }
    });

    it('should not reload when closing via X button', async () => {
      const user = userEvent.setup();
      const reloadSpy = vi.fn();
      const originalLocation = window.location;

      try {
        delete (window as { location?: unknown }).location;
        (window as { location: unknown }).location = { ...originalLocation, reload: reloadSpy };

        render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

        // Click X button instead of Save & Reload
        const closeButton = screen.getByRole('button', { name: /close settings menu/i });
        await user.click(closeButton);

        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(reloadSpy).not.toHaveBeenCalled();
      } finally {
        (window as { location: unknown }).location = originalLocation;
      }
    });

    it('should not reload when clicking overlay background', async () => {
      const user = userEvent.setup();
      const reloadSpy = vi.fn();
      const originalLocation = window.location;

      try {
        delete (window as { location?: unknown }).location;
        (window as { location: unknown }).location = { ...originalLocation, reload: reloadSpy };

        render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

        // Click overlay (not Save & Reload button)
        const overlay = screen.getByRole('dialog');
        await user.click(overlay);

        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(reloadSpy).not.toHaveBeenCalled();
      } finally {
        (window as { location: unknown }).location = originalLocation;
      }
    });

    it('should reload page in real-world scenario: parent sets isVisible=false after onClose', async () => {
      const user = userEvent.setup();
      const reloadSpy = vi.fn();
      const originalLocation = window.location;

      try {
        delete (window as { location?: unknown }).location;
        (window as { location: unknown }).location = { ...originalLocation, reload: reloadSpy };

        // Simulate real-world usage with parent component
        let isVisible = true;
        const handleClose = () => {
          isVisible = false; // Parent sets isVisible to false
        };

        const { rerender } = render(<SecretSettings isVisible={isVisible} onClose={handleClose} />);

        const button = screen.getByText(/Save & Reload/i);
        await user.click(button);

        // Simulate parent re-render after onClose sets isVisible=false
        rerender(<SecretSettings isVisible={false} onClose={handleClose} />);

        // Component is now unmounted (returns null when isVisible=false)
        expect(screen.queryByText(/Secret Settings/i)).not.toBeInTheDocument();

        await new Promise((resolve) => setTimeout(resolve, 150));

        // Reload should still happen despite component being unmounted
        expect(reloadSpy).toHaveBeenCalledTimes(1);
      } finally {
        (window as { location: unknown }).location = originalLocation;
      }
    });
  });
});
