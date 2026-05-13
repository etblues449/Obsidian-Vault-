import { type Slide } from '../data';

type Props = {
  slide: Slide;
  size?: 'full' | 'mini';
  slideNum?: number;
  total?: number;
};

export function CarouselCard({ slide, size = 'full', slideNum, total }: Props) {
  const isMini = size === 'mini';

  return (
    <div
      className="relative flex flex-col justify-between rounded-lg overflow-hidden grain"
      style={{
        backgroundColor: slide.bgColor,
        aspectRatio: '9/16',
        width: isMini ? '100%' : undefined,
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(139,92,246,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Slide number badge */}
      {slideNum !== undefined && (
        <div className="absolute top-2 left-2 font-geist text-[9px] text-white/30">
          {slideNum}/{total}
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 flex flex-col justify-center ${isMini ? 'p-2' : 'p-6'}`}>
        <h2
          className={`font-bebas text-white leading-none uppercase ${
            isMini ? 'text-sm' : 'text-5xl'
          }`}
          style={{
            background: isMini ? undefined : 'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.75) 100%)',
            WebkitBackgroundClip: isMini ? undefined : 'text',
            WebkitTextFillColor: isMini ? undefined : 'transparent',
            backgroundClip: isMini ? undefined : 'text',
          }}
        >
          {slide.headline}
        </h2>
        {!isMini && (
          <p className="mt-4 text-white/50 text-sm font-manrope leading-relaxed">
            {slide.bodyCopy}
          </p>
        )}
      </div>

      {/* Bottom brand bar */}
      {!isMini && (
        <div className="px-6 py-3 flex items-center justify-between border-t border-white/5">
          <span className="font-bebas text-purple-400 tracking-widest text-sm">TAKI</span>
          <span className="font-geist text-white/20 text-[10px]">@takiwong</span>
        </div>
      )}
    </div>
  );
}
