import { Settings, User } from 'lucide-react';

const TABS = ['Carousel', 'UGC', 'LinkedIn', 'Email', 'Blog'];

type Props = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  topic: string;
  onTopicChange: (t: string) => void;
};

export function Header({ activeTab, onTabChange, topic, onTopicChange }: Props) {
  return (
    <header className="flex-shrink-0 border-b border-white/5 bg-[#0f0d15]">
      {/* Top row */}
      <div className="flex items-center justify-between px-4 h-10">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-purple-600 rounded flex items-center justify-center">
            <span className="font-bebas text-white text-[11px] leading-none">T</span>
          </div>
          <span className="font-bebas text-white tracking-widest text-base">TAKI</span>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-3 py-1 text-xs font-geist rounded transition-colors ${
                tab === activeTab
                  ? 'text-white bg-white/10'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="flex items-center gap-2 text-white/30">
          <Settings size={14} className="hover:text-white cursor-pointer transition-colors" />
          <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center">
            <User size={12} className="text-white" />
          </div>
        </div>
      </div>

      {/* Topic input */}
      <div className="px-4 pb-2">
        <input
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          className="w-full bg-[#0d0d0d] border border-white/[0.06] rounded text-xs text-white/60 px-3 py-1.5 focus:outline-none focus:border-purple-500/50 transition-colors font-manrope"
          placeholder="Enter your topic or idea..."
        />
      </div>
    </header>
  );
}
