import { SLIDES } from '../data';

type Props = {
  activeSlide: number;
};

function ScriptField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-geist text-white/30 uppercase tracking-widest">{label}</label>
      {multiline ? (
        <textarea
          defaultValue={value}
          rows={3}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded text-xs text-white/70 p-2 resize-none focus:outline-none focus:border-purple-500/50 transition-colors font-manrope leading-relaxed"
        />
      ) : (
        <input
          defaultValue={value}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded text-xs text-white/70 px-2 py-1.5 focus:outline-none focus:border-purple-500/50 transition-colors font-manrope"
        />
      )}
    </div>
  );
}

function SlideScript({ slide, label }: { slide: (typeof SLIDES)[0]; label: string }) {
  return (
    <div className="flex-1 min-w-0 space-y-2.5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-geist text-purple-400 uppercase tracking-widest">{label}</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>
      <ScriptField label="Headline" value={slide.headline} />
      <ScriptField label="Body Copy" value={slide.bodyCopy} multiline />
      <ScriptField label="Transition" value={slide.transition} />
      <ScriptField label="Imagery" value={slide.imagery} multiline />
    </div>
  );
}

export function BottomPanel({ activeSlide }: Props) {
  const slide1 = SLIDES[activeSlide];
  const slide2 = SLIDES[Math.min(activeSlide + 1, SLIDES.length - 1)];

  return (
    <section className="border-t border-white/5 bg-[#111827] flex-shrink-0 overflow-y-auto" style={{ height: '42%' }}>
      <div className="flex gap-6 p-4 h-full">
        <SlideScript slide={slide1} label={`Slide ${activeSlide + 1}`} />
        <div className="w-px bg-white/5 flex-shrink-0" />
        <SlideScript slide={slide2} label={`Slide ${Math.min(activeSlide + 2, SLIDES.length)}`} />
      </div>
    </section>
  );
}
