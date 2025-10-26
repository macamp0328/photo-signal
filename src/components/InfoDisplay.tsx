import type { Concert } from '../types';

interface InfoDisplayProps {
  concert: Concert | null;
  opacity: number;
}

export default function InfoDisplay({ concert, opacity }: InfoDisplayProps) {
  if (!concert) return null;

  return (
    <div 
      className="absolute bottom-8 left-0 right-0 px-6 text-center text-white transition-opacity duration-500"
      style={{ opacity }}
    >
      <h2 className="text-3xl font-bold mb-2">{concert.band}</h2>
      <p className="text-xl mb-1">{concert.venue}</p>
      <p className="text-lg opacity-80">{new Date(concert.date).toLocaleDateString()}</p>
    </div>
  );
}
