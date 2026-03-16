import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

      expect(container.firstChild).toBeNull();
    });

    it('should be shown when isVisible is true', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

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

    it('should display venue name in meta line', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const details = screen.getByLabelText('Concert details');
      expect(details).toHaveTextContent('Abbey Road Studios');
    });

    it('should display formatted date in meta line', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const details = screen.getByLabelText('Concert details');
      expect(details).toHaveTextContent('August 15, 2023 at 8:00 PM');
    });

    it('should display all concert information together', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      expect(screen.getByText('The Beatles')).toBeInTheDocument();
      const details = screen.getByLabelText('Concert details');
      expect(details).toHaveTextContent('Abbey Road Studios');
      expect(details).toHaveTextContent('August 15, 2023 at 8:00 PM');
    });
  });

  describe('Date Formatting', () => {
    it('should format date "2023-08-15T20:00:00-05:00" with time', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2023-08-15T20:00:00-05:00',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      const details = screen.getByLabelText('Concert details');
      expect(details).toHaveTextContent('August 15, 2023 at 8:00 PM');
    });

    it('should format date "2024-01-01" as "January 1, 2024"', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2024-01-01T00:00:00-06:00',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      const details = screen.getByLabelText('Concert details');
      expect(details).toHaveTextContent('January 1, 2024');
    });

    it('should format date "2024-12-31" as "December 31, 2024"', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2024-12-31T18:30:00-06:00',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      const details = screen.getByLabelText('Concert details');
      expect(details).toHaveTextContent('December 31, 2024');
    });

    it('should include time when timestamp includes time data', () => {
      const concert: Concert = {
        ...mockConcert,
        date: '2023-08-15T21:30:00-05:00',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      const details = screen.getByLabelText('Concert details');
      expect(details).toHaveTextContent('August 15, 2023 at 9:30 PM');
    });
  });

  describe('Null Concert Handling', () => {
    it('should handle null concert gracefully', () => {
      const { container } = render(<InfoDisplay concert={null} isVisible={true} />);

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

  describe('CSS Classes', () => {
    it('should apply overlay class', () => {
      const { container } = render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const section = container.querySelector('section');
      expect(section?.className).toContain('overlay');
    });

    it('should apply bandName class to band heading', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      const bandName = screen.getByText('The Beatles');
      expect(bandName.className).toContain('bandName');
    });
  });

  describe('Next Button', () => {
    it('renders next button when onClose is provided', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} onClose={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'Go to next photo' })).toBeInTheDocument();
    });

    it('calls onClose when next button is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<InfoDisplay concert={mockConcert} isVisible={true} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: 'Go to next photo' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not render next button when onClose is not provided', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      expect(screen.queryByRole('button', { name: 'Go to next photo' })).not.toBeInTheDocument();
    });
  });

  describe('EXIF Metadata', () => {
    it('renders exif line when any EXIF field is present', () => {
      const concert: Concert = {
        ...mockConcert,
        aperture: 'f/1.8',
        shutterSpeed: '1/500',
        iso: '800',
        focalLength: '35mm',
      };

      render(<InfoDisplay concert={concert} isVisible={true} />);

      const details = screen.getByLabelText('Concert details');
      expect(details).toHaveTextContent('f/1.8');
      expect(details).toHaveTextContent('1/500');
      expect(details).toHaveTextContent('ISO 800');
      expect(details).toHaveTextContent('35mm');
    });

    it('does not render exif line when no EXIF fields are present', () => {
      render(<InfoDisplay concert={mockConcert} isVisible={true} />);

      // mockConcert has no EXIF fields — verify none appear
      const details = screen.getByLabelText('Concert details');
      expect(details).not.toHaveTextContent('ISO');
      expect(details).not.toHaveTextContent('f/');
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

      const details = screen.getByLabelText('Concert details');
      expect(details).toHaveTextContent(
        'A Very Long Venue Name That Might Overflow The Container Width'
      );
    });

    it('should handle both isVisible false and null concert', () => {
      const { container } = render(<InfoDisplay concert={null} isVisible={false} />);

      expect(container.firstChild).toBeNull();
    });
  });
});
