import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecretMenu } from './SecretMenu';
import type { FeatureFlag, CustomSetting } from './types';

describe('SecretMenu', () => {
  describe('Visibility', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(<SecretMenu isOpen={false} onClose={vi.fn()} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Secret Menu')).toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when backdrop is clicked', async () => {
      const onClose = vi.fn();
      const { container } = render(<SecretMenu isOpen={true} onClose={onClose} />);

      const backdrop = container.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();

      if (backdrop) {
        await userEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should call onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      render(<SecretMenu isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close secret menu');
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Feature Flags Section', () => {
    it('should show empty state when no feature flags provided', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Feature Flags')).toBeInTheDocument();
      expect(screen.getByText(/No feature flags available yet/)).toBeInTheDocument();
    });

    it('should display feature flags when provided', () => {
      const flags: FeatureFlag[] = [
        {
          id: 'test-flag',
          name: 'Test Feature',
          description: 'This is a test feature',
          enabled: false,
        },
      ];

      render(<SecretMenu isOpen={true} onClose={vi.fn()} featureFlags={flags} />);

      expect(screen.getByText('Test Feature')).toBeInTheDocument();
      expect(screen.getByText('This is a test feature')).toBeInTheDocument();
    });

    it('should display multiple feature flags', () => {
      const flags: FeatureFlag[] = [
        {
          id: 'flag-1',
          name: 'Feature One',
          description: 'First feature',
          enabled: false,
        },
        {
          id: 'flag-2',
          name: 'Feature Two',
          description: 'Second feature',
          enabled: true,
        },
      ];

      render(<SecretMenu isOpen={true} onClose={vi.fn()} featureFlags={flags} />);

      expect(screen.getByText('Feature One')).toBeInTheDocument();
      expect(screen.getByText('Feature Two')).toBeInTheDocument();
      expect(screen.getByText('First feature')).toBeInTheDocument();
      expect(screen.getByText('Second feature')).toBeInTheDocument();
    });

    it('should display category when provided', () => {
      const flags: FeatureFlag[] = [
        {
          id: 'test-flag',
          name: 'Test Feature',
          description: 'Test description',
          enabled: false,
          category: 'Experimental',
        },
      ];

      render(<SecretMenu isOpen={true} onClose={vi.fn()} featureFlags={flags} />);

      expect(screen.getByText('Category: Experimental')).toBeInTheDocument();
    });

    it('should call onFeatureFlagToggle when flag is toggled', async () => {
      const onToggle = vi.fn();
      const flags: FeatureFlag[] = [
        {
          id: 'test-flag',
          name: 'Test Feature',
          description: 'Test description',
          enabled: false,
        },
      ];

      render(
        <SecretMenu
          isOpen={true}
          onClose={vi.fn()}
          featureFlags={flags}
          onFeatureFlagToggle={onToggle}
        />
      );

      const toggleInput = screen.getByRole('checkbox');
      await userEvent.click(toggleInput);

      expect(onToggle).toHaveBeenCalledWith('test-flag', true);
    });

    it('should show correct toggle state for enabled flags', () => {
      const flags: FeatureFlag[] = [
        {
          id: 'enabled-flag',
          name: 'Enabled Feature',
          description: 'This is enabled',
          enabled: true,
        },
      ];

      render(<SecretMenu isOpen={true} onClose={vi.fn()} featureFlags={flags} />);

      const toggleInput = screen.getByRole('checkbox');
      expect(toggleInput).toBeChecked();
    });

    it('should show correct toggle state for disabled flags', () => {
      const flags: FeatureFlag[] = [
        {
          id: 'disabled-flag',
          name: 'Disabled Feature',
          description: 'This is disabled',
          enabled: false,
        },
      ];

      render(<SecretMenu isOpen={true} onClose={vi.fn()} featureFlags={flags} />);

      const toggleInput = screen.getByRole('checkbox');
      expect(toggleInput).not.toBeChecked();
    });
  });

  describe('Custom Settings Section', () => {
    it('should show empty state when no settings provided', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Custom Settings')).toBeInTheDocument();
      expect(screen.getByText(/No custom settings available yet/)).toBeInTheDocument();
    });

    it('should display custom settings when provided', () => {
      const settings: CustomSetting[] = [
        {
          id: 'test-setting',
          name: 'Test Setting',
          description: 'This is a test setting',
          type: 'boolean',
          value: false,
        },
      ];

      render(<SecretMenu isOpen={true} onClose={vi.fn()} customSettings={settings} />);

      expect(screen.getByText('Test Setting')).toBeInTheDocument();
      expect(screen.getByText('This is a test setting')).toBeInTheDocument();
    });

    it('should display multiple settings', () => {
      const settings: CustomSetting[] = [
        {
          id: 'setting-1',
          name: 'Setting One',
          description: 'First setting',
          type: 'boolean',
          value: true,
        },
        {
          id: 'setting-2',
          name: 'Setting Two',
          description: 'Second setting',
          type: 'number',
          value: 50,
        },
      ];

      render(<SecretMenu isOpen={true} onClose={vi.fn()} customSettings={settings} />);

      expect(screen.getByText('Setting One')).toBeInTheDocument();
      expect(screen.getByText('Setting Two')).toBeInTheDocument();
    });

    it('should display setting type and value', () => {
      const settings: CustomSetting[] = [
        {
          id: 'number-setting',
          name: 'Number Setting',
          description: 'A number setting',
          type: 'number',
          value: 42,
        },
      ];

      render(<SecretMenu isOpen={true} onClose={vi.fn()} customSettings={settings} />);

      expect(screen.getByText(/Type: number/)).toBeInTheDocument();
      expect(screen.getByText(/Current: 42/)).toBeInTheDocument();
    });

    it('should display category when provided', () => {
      const settings: CustomSetting[] = [
        {
          id: 'test-setting',
          name: 'Test Setting',
          description: 'Test description',
          type: 'boolean',
          value: false,
          category: 'Advanced',
        },
      ];

      render(<SecretMenu isOpen={true} onClose={vi.fn()} customSettings={settings} />);

      expect(screen.getByText('Category: Advanced')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'secret-menu-title');
    });

    it('should have accessible close button', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const closeButton = screen.getByLabelText('Close secret menu');
      expect(closeButton).toBeInTheDocument();
    });

    it('should have accessible title', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const title = screen.getByText('Secret Menu');
      expect(title).toHaveAttribute('id', 'secret-menu-title');
    });
  });

  describe('UI Structure', () => {
    it('should render header with title and close button', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Secret Menu')).toBeInTheDocument();
      expect(screen.getByLabelText('Close secret menu')).toBeInTheDocument();
    });

    it('should render both sections', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Feature Flags')).toBeInTheDocument();
      expect(screen.getByText('Custom Settings')).toBeInTheDocument();
    });

    it('should render footer with instructions', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/Triple-tap the center of the screen to access it anytime/)
      ).toBeInTheDocument();
    });

    it('should render section icons', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      // Check for emoji in headings
      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Documentation Links', () => {
    it('should show README reference in empty feature flags state', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const codeElements = screen.getAllByText(/src\/modules\/secret-menu\/README\.md/);
      expect(codeElements.length).toBeGreaterThan(0);
    });

    it('should show README reference in empty settings state', () => {
      render(<SecretMenu isOpen={true} onClose={vi.fn()} />);

      const references = screen.getAllByText(/how to add new/);
      expect(references.length).toBeGreaterThan(0);
    });
  });
});
