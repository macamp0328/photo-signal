import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { setupBrowserMocks, createMockMediaStream } from './__tests__/integration/setup';

describe('Secret Settings access', () => {
  beforeEach(() => {
    setupBrowserMocks();
  });

  it('reopens after toggling a feature flag and closing menu', async () => {
    const user = userEvent.setup();
    const { mockStream } = createMockMediaStream();
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

    render(<App />);

    // Activate camera to get to the active view where the Settings button lives
    await user.click(screen.getByRole('button', { name: 'Activate camera and begin experience' }));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());

    // Open via Settings button
    await user.click(screen.getByRole('button', { name: /open settings/i }));

    const menu = await screen.findByRole('document', { name: /secret settings menu/i });
    expect(menu).toBeInTheDocument();

    // Toggle a feature flag inside the menu to mirror real usage
    const debugOverlayCheckbox = screen.getByRole('checkbox', { name: /debug overlay/i });
    await user.click(debugOverlayCheckbox);

    // Close the menu via close button
    const closeButton = screen.getByLabelText(/close settings menu/i);
    await user.click(closeButton);

    expect(
      screen.queryByRole('document', { name: /secret settings menu/i })
    ).not.toBeInTheDocument();

    // Reopen via Settings button after settings change
    await user.click(screen.getByRole('button', { name: /open settings/i }));

    expect(
      await screen.findByRole('document', { name: /secret settings menu/i })
    ).toBeInTheDocument();
  });
});
