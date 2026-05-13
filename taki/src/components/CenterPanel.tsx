import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SLIDES, type Slide } from '../data';
import { CarouselCard } from './CarouselCard';

type Props = {
  activeSlide: number;
  onSlideChange: (n: number) => void;
};

export function CenterPanel({ activeSlide, onSlideChange }: Props) {
  const slide = SLIDES[activeSlide];
  const total = SLIDES.length;

  const prev = () => onSlideChange(Math.max(0, activeSlide - 1));
  const next = () => onSlideChange(Math.min(total - 1, activeSlide + 1));

  return (
    <main className="flex-1 flex flex-col items-center justify-start overflow-hidden bg-[#0d0d0d] px-6 py-4 gap-4">
      {/* Carousel preview + nav */}
      <div className="flex items-center gap-4 flex-1 min-h-0 w-full justify-center">
        <NavBtn onClick={prev} disabled={activeSlide === 0}>
          <ChevronLeft size={18} />
        </NavBtn>

        <div className="h-full max-h-[420px] flex-shrink-0" style={{ aspectRatio: '9/16' }}>
          <CarouselCard slide={slide} slideNum={activeSlide + 1} total={total} />
        </div>

        <NavBtn onClick={next} disabled={activeSlide === total - 1}>
          <ChevronRight size={18} />
        </NavBtn>
      </div>

      {/* Slide counter */}
      <div className="font-geist text-xs text-white/30">
        {activeSlide + 1} / {total}
      </div>

      {/* Thumbnail strip */}
      <ThumbnailStrip activeSlide={activeSlide} onSelect={onSlideChange} slides={SLIDES} />
    </main>
  );
}

function NavBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 text-white/40 hover:text-white hover:border-purple-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex-shrink-0"
    >
      {children}
    </button>
  );
}

function ThumbnailStrip({ slides, activeSlide, onSelect }: { slides: Slide[]; activeSlide: number; onSelect: (n: number) => void }) {
  return (
    <div className="flex gap-1.5 w-full overflow-x-auto pb-1">
      {slides.map((slide, i) => (
        <button
          key={slide.id}
          onClick={() => onSelect(i)}
          className={`slide-thumb flex-shrink-0 w-8 ${i === activeSlide ? 'active' : ''}`}
        >
          <span
            className="font-bebas text-[6px] text-white/60 px-0.5 text-center leading-tight line-clamp-3"
          >
            {slide.headline}
          </span>
        </button>
      ))}
    </div>
  );
}
