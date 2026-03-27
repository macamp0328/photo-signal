import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { dataService } from '../../services/data-service';
import type { Concert } from '../../types';
import { PowerOnIntro } from './PowerOnIntro';

const introConcerts: Concert[] = [
  {
    id: 1,
    band: 'Signal Ghost',
    songTitle: 'Static Bloom',
    venue: 'Mirror Hall',
    date: '2024-03-10T19:00:00-05:00',
    audioFile: '/audio/static-bloom.opus',
    imageFile: '/assets/prod-photographs/R0043553.jpg',
    photoUrl: 'https://photo-cdn.example.com/prod/photos/r0043553.jpg',
  },
  {
    id: 2,
    band: 'Signal Ghost',
    songTitle: 'Static Bloom II',
    venue: 'Mirror Hall',
    date: '2024-03-10T20:00:00-05:00',
    audioFile: '/audio/static-bloom-ii.opus',
    imageFile: '/assets/prod-photographs/R0043637.jpg',
    photoUrl: 'https://photo-cdn.example.com/prod/photos/r0043637.jpg',
  },
  {
    id: 3,
    band: 'Prism Choir',
    songTitle: 'Amber Carrier',
    venue: 'Tube Stage',
    date: '2024-03-11T21:00:00-05:00',
    audioFile: '/audio/amber-carrier.opus',
    imageFile: '/assets/prod-photographs/R0051464.jpg',
    photoUrl: 'https://photo-cdn.example.com/prod/photos/r0051464.jpg',
  },
];

describe('PowerOnIntro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(dataService, 'getConcerts').mockResolvedValue(introConcerts);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders the intro shell', () => {
    render(<PowerOnIntro onComplete={vi.fn()} />);

    const intro = screen.getByLabelText('Power-on intro');

    expect(intro).toBeInTheDocument();
    expect(intro).toHaveAttribute('data-phase', 'black');
  });

  it('renders mirrored photo panes from concert photo urls', async () => {
    const { container } = render(<PowerOnIntro onComplete={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-photo-mirage="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-mirage-pane="true"]').length).toBeGreaterThan(0);
  });

  it('advances through the longer phase sequence before completing', () => {
    render(<PowerOnIntro onComplete={vi.fn()} />);
    const intro = screen.getByLabelText('Power-on intro');

    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(intro).toHaveAttribute('data-phase', 'raster');

    act(() => {
      vi.advanceTimersByTime(6500);
    });
    expect(intro).toHaveAttribute('data-phase', 'drift');
  });

  it('calls onComplete after the full sequence duration', () => {
    const onComplete = vi.fn();

    render(<PowerOnIntro onComplete={onComplete} />);

    act(() => {
      vi.advanceTimersByTime(23000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
