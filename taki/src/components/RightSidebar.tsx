import { Edit3 } from 'lucide-react';
import { SLIDES, COLOR_PALETTES } from '../data';
import { CarouselCard } from './CarouselCard';

type Props = {
  activeSlide: number;
  onSlideChange: (n: number) => void;
  selectedPalette: number;
  onPaletteChange: (i: number) => void;
};

export function RightSidebar({ activeSlide, onSlideChange, selectedPalette, onPaletteChange }: Props) {
  const nextIndex = Math.min(activeSlide + 1, SLIDES.length - 1);
  const nextSlide = SLIDES[nextIndex];

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-l border-white/5 bg-[#111827] overflow-y-auto">
      {/* Next slide preview */}
      <div className="p-3 border-b border-white/5">
        <p className="text-[10px] font-geist text-white/30 uppercase tracking-widest mb-2">
          Up Next — Slide {nextIndex + 1}
        </p>
        <div className="w-full" onClick={() => onSlideChange(nextIndex)} style={{ cursor: 'pointer' }}>
          <CarouselCard slide={nextSlide} size="mini" />
        </div>
      </div>

      {/* Edit slide button */}
      <div className="px-3 py-2 border-b border-white/5">
        <button className="w-full flex items-center justify-center gap-1.5 border border-white/10 hover:border-purple-500 text-white/50 hover:text-white text-xs py-1.5 rounded transition-all font-geist">
          <Edit3 size={11} />
          Edit Slide
        </button>
      </div>

      {/* Typography */}
      <div className="px-3 py-2.5 border-b border-white/5">
        <p className="text-[10px] font-geist text-white/30 uppercase tracking-widest mb-2">Typography</p>
        <div className="space-y-1.5">
          <TypeOption label="Bebas Neue" active />
          <TypeOption label="Manrope" />
          <TypeOption label="Inter" />
        </div>
      </div>

      {/* Palette */}
      <div className="px-3 py-2.5">
        <p className="text-[10px] font-geist text-white/30 uppercase tracking-widest mb-2">Palette</p>
        <div className="flex flex-wrap gap-2">
          {COLOR_PALETTES.map((p, i) => (
            <button
              key={p.name}
              onClick={() => onPaletteChange(i)}
              title={p.name}
              className={`w-6 h-6 rounded border-2 transition-all ${
                i === selectedPalette ? 'border-purple-400 scale-110' : 'border-white/10 hover:border-white/30'
              }`}
              style={{ backgroundColor: p.bg }}
            >
              <span
                className="block w-2 h-2 rounded-full mx-auto"
                style={{ backgroundColor: p.accent }}
              />
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function TypeOption({ label, active }: { label: string; active?: boolean }) {
  return (
    <div
      className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
        active
          ? 'bg-purple-900/40 text-purple-300 border border-purple-500/30'
          : 'text-white/40 hover:text-white/60 border border-transparent hover:border-white/10'
      }`}
    >
      {label}
    </div>
  );
}
