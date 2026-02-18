import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const tripleTapCenter = () => {
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    clientX: window.innerWidth / 2,
    clientY: window.innerHeight / 2,
  });

  window.dispatchEvent(clickEvent);
  window.dispatchEvent(clickEvent);
  window.dispatchEvent(clickEvent);
};

describe('Secret Settings access', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
  });

  it('reopens after changing settings and closing menu', async () => {
    render(<App />);

    // Open via triple tap
    tripleTapCenter();

    const menu = await screen.findByRole('document', { name: /secret settings menu/i });
    expect(menu).toBeInTheDocument();

    // Change a setting inside the menu to mirror real usage
    const recognitionDelay = (await screen.findByLabelText(
      /recognition delay/i
    )) as HTMLInputElement;
    fireEvent.change(recognitionDelay, { target: { value: '1200' } });

    // Close the menu via close button
    const closeButton = screen.getByLabelText(/close settings menu/i);
    await userEvent.click(closeButton);

    expect(
      screen.queryByRole('document', { name: /secret settings menu/i })
    ).not.toBeInTheDocument();

    // Reopen via triple tap after settings change
    tripleTapCenter();

    expect(
      await screen.findByRole('document', { name: /secret settings menu/i })
    ).toBeInTheDocument();
  });
});
