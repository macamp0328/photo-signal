import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PowerOnIntro } from './PowerOnIntro';

describe('PowerOnIntro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the intro shell', () => {
    render(<PowerOnIntro onComplete={vi.fn()} />);

    expect(screen.getByLabelText('Power-on intro')).toBeInTheDocument();
  });

  it('calls onComplete after the full sequence duration', () => {
    const onComplete = vi.fn();

    render(<PowerOnIntro onComplete={onComplete} />);

    vi.advanceTimersByTime(17000);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
