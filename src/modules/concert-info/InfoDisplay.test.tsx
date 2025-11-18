import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoDisplay } from './InfoDisplay';
import type { Concert } from '../../types';

describe('InfoDisplay', () => {
  const mockConcert: Concert = {
    id: 1,
    band: 'The Beatles',
    venue: 'Abbey Road Studios',
    date: '2023-08-15',
    audioFile: '/audio/beatles.opus',
  };

  describe('Visibility', () => {
    it('should return null when isVisible is false', () => {
      const { container } = render(<InfoDisplay concert={mockConcert} isVisible={false} />);

      // Component should return null for better performance
      expect(container.firstChild).toBeNull();
    });

    it('should be shown when isVisible is true', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      // Verify component is rendered by checking for band name
      expect(screen.getByText('The Beatles')).toBeInTheDocument();
    });

    it('should return null when concert is null even if isVisible is true', () => {
      const { container } = render(<InfoDisplay concert={null} isVisible={true} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Concert Data Display', () => {
    it('should display band name', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const bandName = screen.getByText('The Beatles');
      expect(bandName).toBeInTheDocument();
      expect(bandName.tagName).toBe('H2');
    });

    it('should display venue name', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const venue = screen.getByText('Abbey Road Studios');
      expect(venue).toBeInTheDocument();
      expect(venue.tagName).toBe('P');
    });

    it('should display formatted date', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      // Date should be formatted as "August 15, 2023"
      const formattedDate = screen.getByText('August 15, 2023');
      expect(formattedDate).toBeInTheDocument();
    });

    it('should display all concert information together', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      expect(screen.getByText('The Beatles')).toBeInTheDocument();
      expect(screen.getByText('Abbey Road Studios')).toBeInTheDocument();
      expect(screen.getByText('August 15, 2023')).toBeInTheDocument();
    });

    it('should display "Now Playing" label', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      expect(screen.getByText('Now Playing')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format date "2023-08-15" as "August 15, 2023"', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2023-08-15',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(screen.getByText('August 15, 2023')).toBeInTheDocument();
    });

    it('should format date "2024-01-01" as "January 1, 2024"', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2024-01-01',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(screen.getByText('January 1, 2024')).toBeInTheDocument();
    });

    it('should format date "2024-12-31" as "December 31, 2024"', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2024-12-31',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(screen.getByText('December 31, 2024')).toBeInTheDocument();
    });
  });

  describe('Null Concert Handling', () => {
    it('should handle null concert gracefully', () => {
      const { container } = render(<InfoDisplay concert={null} isVisible={true} />);

      // Component returns null when concert is null
      expect(container.firstChild).toBeNull();
    });

    it('should not throw error with null concert', () => {
      expect(() => {
        render(<InfoDisplay concert={null} isVisible={true} />);
      }).not.toThrow();
    });

    it('should be hidden when concert is null even if isVisible is true', () => {
      const { container } = render(<InfoDisplay concert={null} isVisible={true} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('CSS Classes and Transitions', () => {
    it('should apply card-style classes', () => {
      const { container } = render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const displayDiv = container.querySelector('div');
      // Check for CSS Module class names
      expect(displayDiv?.className).toContain('card');
    });

    it('should apply custom className prop', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} className="custom-class" />
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('custom-class');
    });

    it('should apply padding classes', () => {
      const { container } = render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const displayDiv = container.querySelector('div');
      // CSS Module handles padding through the card class
      expect(displayDiv?.className).toContain('card');
    });

    it('should apply proper text sizing classes', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const bandName = screen.getByText('The Beatles');
      // Check for CSS Module class
      expect(bandName.className).toContain('bandName');

      const venue = screen.getByText('Abbey Road Studios');
      expect(venue.className).toContain('venue');

      const date = screen.getByText('August 15, 2023');
      expect(date.className).toContain('date');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concert with empty string values', () => {
      const concert: Concert = {
        id: 1,
        band: '',
        venue: '',
        date: '2023-08-15',
        audioFile: '',
      };

      const { container } = render(<InfoDisplay concert={concert} isVisible={true} />);

      // Component should still render
      expect(container.querySelector('div')).toBeInTheDocument();
      expect(screen.getByText('August 15, 2023')).toBeInTheDocument();
    });

    it('should handle very long band names', () => {
      const concert: Concert = {
        ...mockConcert,
        band: 'A Very Long Band Name That Might Overflow The Container Width',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(
        screen.getByText('A Very Long Band Name That Might Overflow The Container Width')
      ).toBeInTheDocument();
    });

    it('should handle very long venue names', () => {
      const concert: Concert = {
        ...mockConcert,
        venue: 'A Very Long Venue Name That Might Overflow The Container Width',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(
        screen.getByText('A Very Long Venue Name That Might Overflow The Container Width')
      ).toBeInTheDocument();
    });

    it('should handle both isVisible false and null concert', () => {
      const { container } = render(<InfoDisplay concert={null} isVisible={false} />);

      expect(container.firstChild).toBeNull();
    });
  });
});
