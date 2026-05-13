import { RefreshCw, Sparkles } from 'lucide-react';
import { CONTENT_IDEAS, type ContentIdea } from '../data';
import { StarRating } from './StarRating';

type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
};

export function LeftSidebar({ selectedId, onSelect }: Props) {
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#111827]">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/60 font-geist uppercase tracking-widest">
          Content Ideas
        </span>
        <button className="text-white/30 hover:text-purple-400 transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Generate button */}
      <div className="px-3 py-2 border-b border-white/5">
        <button className="w-full flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium py-1.5 rounded transition-colors font-geist">
          <Sparkles size={11} />
          Generate New Ideas
        </button>
      </div>

      {/* Ideas list */}
      <div className="flex-1 overflow-y-auto">
        {CONTENT_IDEAS.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            active={idea.id === selectedId}
            onClick={() => onSelect(idea.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function IdeaCard({ idea, active, onClick }: { idea: ContentIdea; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-white/5 transition-all group ${
        active
          ? 'bg-purple-950/40 border-l-2 border-l-purple-500'
          : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'
      }`}
    >
      <p className={`text-xs leading-snug line-clamp-2 mb-1.5 ${active ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
        {idea.headline}
      </p>
      <div className="flex items-center justify-between">
        <StarRating rating={idea.rating} />
        <div className="flex items-center gap-2 text-[10px] text-white/30 font-geist">
          <span>{idea.views}</span>
          <span>{idea.likes}</span>
        </div>
      </div>
    </button>
  );
}
