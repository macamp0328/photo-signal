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
    audioFile: '/audio/beatles.mp3',
  };

  describe('Visibility', () => {
    it('should be hidden when isVisible is false', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={false} />,
      );

      // Component returns null when not visible
      expect(container.firstChild).toBeNull();
    });

    it('should be shown when isVisible is true', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      // Verify component is in the document by checking for band name
      expect(screen.getByText('The Beatles')).toBeInTheDocument();
    });

    it('should apply opacity-100 class when visible', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('opacity-100');
    });
  });

  describe('Concert Data Display', () => {
    it('should display band name', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const bandName = screen.getByText('The Beatles');
      expect(bandName).toBeInTheDocument();
      expect(bandName.tagName).toBe('H1');
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

  describe('Position Prop Variations', () => {
    it('should position at bottom by default', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('bottom-0');
      expect(displayDiv).toHaveClass('bg-gradient-to-t');
    });

    it('should position at bottom when position="bottom"', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} position="bottom" />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('bottom-0');
      expect(displayDiv).toHaveClass('bg-gradient-to-t');
    });

    it('should position at top when position="top"', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} position="top" />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('top-0');
      expect(displayDiv).toHaveClass('bg-gradient-to-b');
    });

    it('should apply correct gradient for top position', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} position="top" />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('from-black');
      expect(displayDiv).toHaveClass('via-black/90');
      expect(displayDiv).toHaveClass('to-transparent');
    });

    it('should apply correct gradient for bottom position', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} position="bottom" />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('from-black');
      expect(displayDiv).toHaveClass('via-black/90');
      expect(displayDiv).toHaveClass('to-transparent');
    });
  });

  describe('CSS Classes and Transitions', () => {
    it('should apply fixed positioning classes', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('fixed');
      expect(displayDiv).toHaveClass('left-0');
      expect(displayDiv).toHaveClass('right-0');
    });

    it('should apply transition classes for fade animation', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('transition-opacity');
      expect(displayDiv).toHaveClass('duration-500');
    });

    it('should apply custom className prop', () => {
      const { container } = render(
        <InfoDisplay
          concert={mockConcert}
          isVisible={true}
          className="custom-class"
        />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('custom-class');
    });

    it('should apply padding classes', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} />,
      );

      const displayDiv = container.querySelector('div');
      expect(displayDiv).toHaveClass('p-6');
      expect(displayDiv).toHaveClass('pb-8');
    });

    it('should apply text color classes', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} />,
      );

      const innerDiv = container.querySelector('.text-white');
      expect(innerDiv).toBeInTheDocument();
    });

    it('should apply animation class to band name', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const bandName = screen.getByText('The Beatles');
      expect(bandName).toHaveClass('animate-fade-in');
    });

    it('should apply proper text sizing classes', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const bandName = screen.getByText('The Beatles');
      expect(bandName).toHaveClass('text-3xl');
      expect(bandName).toHaveClass('font-bold');

      const venue = screen.getByText('Abbey Road Studios');
      expect(venue).toHaveClass('text-xl');
      expect(venue).toHaveClass('text-gray-300');

      const date = screen.getByText('August 15, 2023');
      expect(date).toHaveClass('text-sm');
      expect(date).toHaveClass('text-gray-400');
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
        screen.getByText('A Very Long Band Name That Might Overflow The Container Width'),
      ).toBeInTheDocument();
    });

    it('should handle very long venue names', () => {
      const concert: Concert = {
        ...mockConcert,
        venue: 'A Very Long Venue Name That Might Overflow The Container Width',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(
        screen.getByText('A Very Long Venue Name That Might Overflow The Container Width'),
      ).toBeInTheDocument();
    });

    it('should handle both isVisible false and null concert', () => {
      const { container } = render(
        <InfoDisplay concert={null} isVisible={false} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
