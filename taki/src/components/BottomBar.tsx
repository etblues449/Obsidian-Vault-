import { Download, Copy, Share2 } from 'lucide-react';

export function BottomBar() {
  return (
    <footer className="flex-shrink-0 h-10 border-t border-white/5 bg-[#0f0d15] flex items-center justify-between px-4">
      <span className="text-[10px] font-geist text-white/20">7 slides · Carousel format · 1080×1920</span>
      <div className="flex items-center gap-2">
        <ActionBtn icon={<Copy size={12} />} label="Copy" />
        <ActionBtn icon={<Share2 size={12} />} label="Share" />
        <button className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1 rounded transition-colors font-geist">
          <Download size={12} />
          Export
        </button>
      </div>
    </footer>
  );
}

function ActionBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-1.5 border border-white/10 hover:border-white/20 text-white/40 hover:text-white/70 text-xs px-2.5 py-1 rounded transition-all font-geist">
      {icon}
      {label}
    </button>
  );
}
