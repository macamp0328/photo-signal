import { Concert } from '../types';

interface InfoDisplayProps {
  concert: Concert | null;
  isVisible: boolean;
}

const InfoDisplay = ({ concert, isVisible }: InfoDisplayProps) => {
  if (!concert || !isVisible) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-6 pb-8 transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="max-w-lg mx-auto text-white">
        <h1 className="text-3xl font-bold mb-2 animate-fade-in">
          {concert.band}
        </h1>
        <p className="text-xl text-gray-300 mb-1">
          {concert.venue}
        </p>
        <p className="text-sm text-gray-400">
          {formatDate(concert.date)}
        </p>
      </div>
    </div>
  );
};

export default InfoDisplay;
