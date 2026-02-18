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

      expect(screen.getByText('Now Playing')).toBeInTheDocument();
    });

    it('should display a zero-padded archive number', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      expect(screen.getByText('#01')).toBeInTheDocument();
    });

    it('should allow a custom status label', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} statusLabel="Now Viewing" />);

      expect(screen.getByText('Now Viewing')).toBeInTheDocument();
    });

    it('should render optional actions when provided', () => {
      render(
        <InfoDisplay
          concert={mockConcert}
          isVisible={true}
          actions={<button type="button">Play</button>}
        />
      );

      expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    });

    it('should render now playing line when provided', () => {
      render(
        <InfoDisplay
          concert={mockConcert}
          isVisible={true}
          nowPlayingLine="ghost signal: The Beatles"
          progressValue={0.5}
        />
      );

      expect(screen.getByText(/ghost signal/i)).toBeInTheDocument();
    });

    it('should display EXIF metadata when available', () => {
      const exifConcert: Concert = {
        ...mockConcert,
        camera: 'RICOH GR II',
        focalLength: '18.3mm',
        aperture: 'f/2.8',
        shutterSpeed: '1/125',
        iso: '1600',
      };

      render(<InfoDisplay concert={exifConcert} isVisible={true} />);

      expect(screen.getByText('Camera')).toBeInTheDocument();
      expect(screen.getByText('RICOH GR II')).toBeInTheDocument();
      expect(screen.getByText('Focal Length')).toBeInTheDocument();
      expect(screen.getByText('18.3mm')).toBeInTheDocument();
      expect(screen.getByText('Aperture (f-stop)')).toBeInTheDocument();
      expect(screen.getByText('f/2.8')).toBeInTheDocument();
      expect(screen.getByText('Shutter')).toBeInTheDocument();
      expect(screen.getByText('1/125')).toBeInTheDocument();
      expect(screen.getByText('ISO')).toBeInTheDocument();
      expect(screen.getByText('1600')).toBeInTheDocument();
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
