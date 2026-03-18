/**
 * Tests for RectangleOverlay
 *
 * Validates:
 * - Returns null for null rectangle or idle state
 * - Returns null for degenerate geometry (NaN, zero-area, inverted winding)
 * - Renders SVG path for a valid rectangle
 * - Scan line rendered only in detecting state
 * - Corner elements rendered for detecting and detected states
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RectangleOverlay } from './RectangleOverlay';
import type { DetectedRectangle } from './types';

// A standard valid rectangle: corners ordered topLeft → topRight → bottomRight → bottomLeft,
// which produces a positive shoelace (signed-area) result in SVG's downward y-axis coordinate system.
const validRect: DetectedRectangle = {
  topLeft: { x: 0.1, y: 0.1 },
  topRight: { x: 0.9, y: 0.1 },
  bottomRight: { x: 0.9, y: 0.9 },
  bottomLeft: { x: 0.1, y: 0.9 },
  width: 0.8,
  height: 0.8,
  aspectRatio: 1,
};

// Inverted winding: bottom corners above top corners
const invertedRect: DetectedRectangle = {
  topLeft: { x: 0.1, y: 0.9 },
  topRight: { x: 0.9, y: 0.9 },
  bottomRight: { x: 0.9, y: 0.1 },
  bottomLeft: { x: 0.1, y: 0.1 },
  width: 0.8,
  height: 0.8,
  aspectRatio: 1,
};

// All corners at the same point — zero area
const zeroAreaRect: DetectedRectangle = {
  topLeft: { x: 0.5, y: 0.5 },
  topRight: { x: 0.5, y: 0.5 },
  bottomRight: { x: 0.5, y: 0.5 },
  bottomLeft: { x: 0.5, y: 0.5 },
  width: 0,
  height: 0,
  aspectRatio: 1,
};

// NaN coordinate
const nanRect: DetectedRectangle = {
  topLeft: { x: NaN, y: 0.1 },
  topRight: { x: 0.9, y: 0.1 },
  bottomRight: { x: 0.9, y: 0.9 },
  bottomLeft: { x: 0.1, y: 0.9 },
  width: 0.8,
  height: 0.8,
  aspectRatio: 1,
};

// Infinity coordinate
const infinityRect: DetectedRectangle = {
  topLeft: { x: 0.1, y: Infinity },
  topRight: { x: 0.9, y: 0.1 },
  bottomRight: { x: 0.9, y: 0.9 },
  bottomLeft: { x: 0.1, y: 0.9 },
  width: 0.8,
  height: 0.8,
  aspectRatio: 1,
};

describe('RectangleOverlay', () => {
  it('renders nothing when rectangle is null', () => {
    const { container } = render(<RectangleOverlay rectangle={null} state="detecting" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when state is idle', () => {
    const { container } = render(<RectangleOverlay rectangle={validRect} state="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for NaN coordinates', () => {
    const { container } = render(<RectangleOverlay rectangle={nanRect} state="detecting" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for Infinity coordinates', () => {
    const { container } = render(<RectangleOverlay rectangle={infinityRect} state="detecting" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for zero-area rectangle', () => {
    const { container } = render(<RectangleOverlay rectangle={zeroAreaRect} state="detecting" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for inverted-winding rectangle', () => {
    const { container } = render(<RectangleOverlay rectangle={invertedRect} state="detecting" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders SVG paths for a valid rectangle in detecting state', () => {
    const { container } = render(<RectangleOverlay rectangle={validRect} state="detecting" />);
    expect(container.firstChild).not.toBeNull();
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
  });

  it('renders SVG paths for a valid rectangle in detected state', () => {
    const { container } = render(<RectangleOverlay rectangle={validRect} state="detected" />);
    expect(container.firstChild).not.toBeNull();
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
  });

  it('renders scan line only in detecting state', () => {
    const { getByTestId, rerender } = render(
      <RectangleOverlay rectangle={validRect} state="detecting" />
    );
    expect(getByTestId('scan-line')).toBeTruthy();

    rerender(<RectangleOverlay rectangle={validRect} state="detected" />);
    expect(document.querySelector('[data-testid="scan-line"]')).toBeNull();
  });

  it('renders four corner elements for detecting state', () => {
    const { container } = render(<RectangleOverlay rectangle={validRect} state="detecting" />);
    const overlay = container.firstChild as HTMLElement;
    // Direct div children of the overlay: scan-line + 4 corners = 5
    const divChildren = Array.from(overlay.children).filter((el) => el.tagName === 'DIV');
    expect(divChildren.length).toBe(5);
  });

  it('renders four corner elements for detected state', () => {
    const { container } = render(<RectangleOverlay rectangle={validRect} state="detected" />);
    const overlay = container.firstChild as HTMLElement;
    // Direct div children of the overlay: 4 corners only (no scan-line)
    const divChildren = Array.from(overlay.children).filter((el) => el.tagName === 'DIV');
    expect(divChildren.length).toBe(4);
  });

  it('encodes corner coordinates in inline styles', () => {
    const { container } = render(<RectangleOverlay rectangle={validRect} state="detected" />);
    const overlay = container.firstChild as HTMLElement;
    // First div child is the top-left corner: left: 10%, top: 10%
    const tl = Array.from(overlay.children).find((el) => el.tagName === 'DIV') as HTMLElement;
    expect(tl.style.left).toBe('10%');
    expect(tl.style.top).toBe('10%');
  });
});
