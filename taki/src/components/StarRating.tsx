import { Star } from 'lucide-react';

export function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={10}
          className={i < rating ? 'star-filled fill-yellow-500' : 'star-empty'}
          strokeWidth={i < rating ? 0 : 1.5}
        />
      ))}
    </div>
  );
}
