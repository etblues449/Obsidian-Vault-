import { useState } from 'react';
import { Header } from './components/Header';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterPanel } from './components/CenterPanel';
import { RightSidebar } from './components/RightSidebar';
import { BottomPanel } from './components/BottomPanel';
import { BottomBar } from './components/BottomBar';
import './index.css';

const DEFAULT_TOPIC = "The rapid acceleration of AI capabilities is changing the competitive landscape, creating unprecedented opportunities for founders who act now.";

export default function App() {
  const [activeTab, setActiveTab] = useState('Carousel');
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [selectedIdea, setSelectedIdea] = useState('1');
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedPalette, setSelectedPalette] = useState(0);

  return (
    <div className="flex flex-col h-screen bg-[#0d0d0d] overflow-hidden">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        topic={topic}
        onTopicChange={setTopic}
      />

      {/* Three-column body */}
      <div className="flex min-h-0" style={{ height: '58%' }}>
        <LeftSidebar selectedId={selectedIdea} onSelect={setSelectedIdea} />
        <CenterPanel activeSlide={activeSlide} onSlideChange={setActiveSlide} />
        <RightSidebar
          activeSlide={activeSlide}
          onSlideChange={setActiveSlide}
          selectedPalette={selectedPalette}
          onPaletteChange={setSelectedPalette}
        />
      </div>

      {/* Bottom content editor */}
      <BottomPanel activeSlide={activeSlide} />

      <BottomBar />
    </div>
  );
}
