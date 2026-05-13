export type ContentIdea = {
  id: string;
  headline: string;
  rating: number;
  views: string;
  likes: string;
};

export type Slide = {
  id: number;
  headline: string;
  bodyCopy: string;
  transition: string;
  imagery: string;
  bgColor: string;
};

export const CONTENT_IDEAS: ContentIdea[] = [
  { id: '1', headline: 'The rapid acceleration of AI capabilities is changing the competitive landscape, creating...', rating: 5, views: '2.1M', likes: '143K' },
  { id: '2', headline: "Despite advances in AI, many businesses still rely heavily on manual processes that AI could automate...", rating: 4, views: '1.4M', likes: '98K' },
  { id: '3', headline: "Many businesses are adopting AI tools but fail to achieve true competitive advantage...", rating: 4, views: '980K', likes: '67K' },
  { id: '4', headline: "Many companies are hesitant or unsure how to fully integrate AI into their workflows...", rating: 3, views: '750K', likes: '52K' },
  { id: '5', headline: "Many businesses often focus on top-line revenue without fully understanding AI's role...", rating: 4, views: '620K', likes: '41K' },
  { id: '6', headline: "Businesses are increasingly trying to leverage AI for competitive advantage but struggle...", rating: 3, views: '510K', likes: '34K' },
  { id: '7', headline: "Businesses assume that AI content creation is purely about automation, missing the creative nuance...", rating: 5, views: '1.8M', likes: '127K' },
  { id: '8', headline: "The proliferation of generic AI content is making it harder for brands to stand out...", rating: 4, views: '890K', likes: '61K' },
  { id: '9', headline: "Businesses are looking for repeatable, scalable ways to create viral social content...", rating: 5, views: '2.4M', likes: '189K' },
  { id: '10', headline: "Businesses assume that AI 'ghost-writing' is unethical without realizing the industry norm...", rating: 3, views: '430K', likes: '29K' },
];

export const SLIDES: Slide[] = [
  {
    id: 1,
    headline: "The 'AI Armageddon' is coming for your business",
    bodyCopy: "And 90% of founders aren't ready →",
    transition: "This stark reality demands immediate attention",
    imagery: "Taki Wong looking gravely at the camera, a subtle digital storm brewing in the background, conveying a sense of impending disruption. Soft, artificial lighting. Deep black background for text. Professional, authoritative mood.",
    bgColor: '#0d0d0d',
  },
  {
    id: 2,
    headline: "Your competitors are quietly deploying 'ghost teams'",
    bodyCopy: "While you're still building human teams, your smartest competitors are automating entire departments with AI agents. These 'ghost teams' operate 24/7, scale infinitely, and have zero payroll overhead. They're already out-innovating you.",
    transition: "This leads to unprecedented market asymmetry",
    imagery: "Taki Wong looking concerned, gesturing towards a shadowy, ethereal figure representing an AI 'ghost team' member. Dark, slightly blue-tinted background.",
    bgColor: '#0a0a18',
  },
  {
    id: 3,
    headline: "The moat is gone. Every advantage you have can be replicated overnight.",
    bodyCopy: "Product features? Copied in weeks. Brand voice? AI can mimic it. Pricing strategy? Undercut instantly. The only remaining advantage is speed of execution.",
    transition: "So what do the winners do differently?",
    imagery: "Abstract visualization of a crumbling castle moat transforming into open digital terrain. Cold blue lighting.",
    bgColor: '#0d0a1a',
  },
  {
    id: 4,
    headline: "Winners vs Losers in the AI era",
    bodyCopy: "Losers: Waiting for 'the right AI strategy'. Winners: Shipping imperfect AI solutions now and iterating. The gap compounds daily.",
    transition: "Here's the framework that separates them",
    imagery: "Split screen concept — left side dark and static, right side dynamic with flowing data streams. High contrast.",
    bgColor: '#0d0d0d',
  },
  {
    id: 5,
    headline: "The open source rebellion just handed you a weapon",
    bodyCopy: "LLaMA. Mistral. DeepSeek. The closed AI giants' moats just evaporated. You now have enterprise-grade AI for $0/month. The question is: are you using it?",
    transition: "And here's exactly how to weaponize it",
    imagery: "Taki Wong holding up a smartphone showing open source code, confident expression, dark background with subtle green terminal aesthetics.",
    bgColor: '#030d08',
  },
  {
    id: 6,
    headline: "Your content is your sales team. Most founders fire 90% of it.",
    bodyCopy: "The average founder posts 3x/week. The top 1% post 3x/day across 5 platforms — with AI. That's 10x the surface area for inbound leads.",
    transition: "This is how you build the content machine",
    imagery: "Visualization of content multiplying across platforms — LinkedIn, TikTok, Twitter, Instagram all lighting up simultaneously.",
    bgColor: '#0d0d0d',
  },
  {
    id: 7,
    headline: "Start now or get left behind. The window is closing.",
    bodyCopy: "Every day you wait, your competitor's AI flywheel spins faster. The compounding effect of AI-augmented execution means the gap between early adopters and laggards doubles every 6 months.",
    transition: "Here's your 3-step action plan for this week",
    imagery: "Countdown clock visualization, urgency-inducing dark red accents, Taki Wong pointing directly at the camera.",
    bgColor: '#120505',
  },
];

export const COLOR_PALETTES = [
  { name: 'Void', bg: '#0d0d0d', accent: '#ffffff' },
  { name: 'Navy', bg: '#0a0a18', accent: '#818cf8' },
  { name: 'Forest', bg: '#030d08', accent: '#34d399' },
  { name: 'Crimson', bg: '#120505', accent: '#f87171' },
  { name: 'Violet', bg: '#0d0a1a', accent: '#a78bfa' },
];
