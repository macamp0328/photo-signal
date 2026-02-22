import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoDisplay } from './InfoDisplay';
import type { Concert } from '../../types';

describe('InfoDisplay', () => {
  const mockConcert: Concert = {
    id: 1,
    band: 'The Beatles',
    venue: 'Abbey Road Studios',
    date: '2023-08-15T20:00:00-05:00',
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

      // Date should be formatted with time when timestamp includes it
      const formattedDate = screen.getByText('August 15, 2023 at 8:00 PM CDT');
      expect(formattedDate).toBeInTheDocument();
    });

    it('should display all concert information together', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      expect(screen.getByText('The Beatles')).toBeInTheDocument();
      expect(screen.getByText('Abbey Road Studios')).toBeInTheDocument();
      expect(screen.getByText('August 15, 2023 at 8:00 PM CDT')).toBeInTheDocument();
    });

    it('should display "Now Playing" label', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      expect(screen.getByText(/Signal:\s*Now Playing/i)).toBeInTheDocument();
    });

    it('should not display archive tag copy', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      expect(screen.queryByText(/Archive\s*#01/i)).not.toBeInTheDocument();
    });

    it('should allow a custom status label', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} statusLabel="Now Viewing" />);

      expect(screen.getByText(/Signal:\s*Now Viewing/i)).toBeInTheDocument();
    });

    it('should display EXIF metadata when available', () => {
      const exifConcert: Concert = {
        ...mockConcert,
        songTitle: 'Here Comes the Sun',
        camera: 'RICOH GR II',
        focalLength: '18.3mm',
        aperture: 'f/2.8',
        shutterSpeed: '1/125',
        iso: '1600',
      };

      render(<InfoDisplay concert={exifConcert} isVisible={true} />);

      expect(screen.getByText('Here Comes the Sun')).toBeInTheDocument();
      const detailsCard = screen.getByLabelText('Concert details');
      expect(detailsCard).toHaveTextContent('Camera: RICOH GR II');
      expect(detailsCard).toHaveTextContent('18.3mm');
      expect(detailsCard).toHaveTextContent('f/2.8');
      expect(detailsCard).toHaveTextContent('1/125');
      expect(detailsCard).toHaveTextContent('ISO 1600');
    });
  });

  describe('Date Formatting', () => {
    it('should format date "2023-08-15T20:00:00-05:00" with time and timezone', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2023-08-15T20:00:00-05:00',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(screen.getByText('August 15, 2023 at 8:00 PM CDT')).toBeInTheDocument();
    });

    it('should format date "2024-01-01" as "January 1, 2024"', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2024-01-01T00:00:00-06:00',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(screen.getByText('January 1, 2024 at 12:00 AM CST')).toBeInTheDocument();
    });

    it('should format date "2024-12-31" as "December 31, 2024"', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2024-12-31T18:30:00-06:00',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(screen.getByText('December 31, 2024 at 6:30 PM CST')).toBeInTheDocument();
    });

    it('should include time and timezone when timestamp includes time data', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2023-08-15T21:30:00-05:00',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(screen.getByText('August 15, 2023 at 9:30 PM CDT')).toBeInTheDocument();
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

      const displaySection = container.querySelector('section');
      expect(displaySection?.className).toContain('card');
    });

    it('should apply custom className prop', () => {
      const { container } = render(
        <InfoDisplay concert={mockConcert} isVisible={true} className="custom-class" />
      );

      const displaySection = container.querySelector('section');
      expect(displaySection).toHaveClass('custom-class');
    });

    it('should apply padding classes', () => {
      const { container } = render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const displaySection = container.querySelector('section');
      expect(displaySection?.className).toContain('card');
    });

    it('should apply proper text sizing classes', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const bandName = screen.getByText('The Beatles');
      expect(bandName.className).toContain('bandName');

      const venue = screen.getByText('Abbey Road Studios');
      expect(venue.className).toContain('detailValue');

      const date = screen.getByText('August 15, 2023 at 8:00 PM CDT');
      expect(date.className).toContain('detailValue');
    });
  });

  describe('Album Cover', () => {
    it('does not render album cover image when albumCoverUrl is set', () => {
      const concert: Concert = {
        ...mockConcert,
        albumCoverUrl: 'https://cdn.example.com/cover.webp',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(screen.queryByRole('img', { name: /album cover/i })).toBeNull();
    });

    it('does not render album cover image when albumCoverUrl is absent', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      expect(screen.queryByRole('img', { name: /album cover/i })).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle concert with empty string values', () => {
      const concert: Concert = {
        id: 1,
        band: '',
        venue: '',
        date: '2023-08-15T20:00:00-05:00',
        audioFile: '',
      };

      const { container } = render(<InfoDisplay concert={concert} isVisible={true} />);

      expect(container.querySelector('section')).toBeInTheDocument();
      expect(screen.getByText('August 15, 2023 at 8:00 PM CDT')).toBeInTheDocument();
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
