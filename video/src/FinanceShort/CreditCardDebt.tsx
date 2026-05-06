import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import { z } from "zod";

export const creditCardDebtSchema = z.object({
  ca: z.string(),
  totalInterest: z.string(),
  perAdult: z.string(),
  apr: z.string(),
  examplePrincipal: z.string(),
});

type Props = z.infer<typeof creditCardDebtSchema>;

const FPS = 30;
const SEC = (s: number) => Math.round(s * FPS);

// Brand palette — dark, neon green for money signal, warm red for debt
const BG = "#0a0d0c";
const BG_GRAD_TO = "#0f1614";
const TEXT = "#f5f7f4";
const MUTED = "#9aa39d";
const MONEY = "#34d399"; // emerald-400
const DEBT = "#f87171"; // red-400
const ACCENT = "#fbbf24"; // amber-400

const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 30%, ${BG_GRAD_TO} 0%, ${BG} 70%)`,
    }}
  />
);

const Grain: React.FC = () => (
  <AbsoluteFill style={{ opacity: 0.05, mixBlendMode: "overlay" }}>
    <svg width="100%" height="100%">
      <filter id="n">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
      </filter>
      <rect width="100%" height="100%" filter="url(#n)" />
    </svg>
  </AbsoluteFill>
);

const FadeUp: React.FC<{
  delay?: number;
  children: React.ReactNode;
  className?: string;
  distance?: number;
}> = ({ delay = 0, children, className, distance = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.6 },
  });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const y = interpolate(s, [0, 1], [distance, 0]);
  return (
    <div
      className={className}
      style={{ opacity, transform: `translateY(${y}px)` }}
    >
      {children}
    </div>
  );
};

const formatGBP = (n: number) => {
  if (n >= 1_000_000_000) return `£${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)
    return `£${Math.round(n).toLocaleString("en-GB")}`;
  return `£${Math.round(n)}`;
};

const Counter: React.FC<{
  from: number;
  to: number;
  duration: number;
  color?: string;
  className?: string;
}> = ({ from, to, duration, color = MONEY, className }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, duration], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const eased = 1 - Math.pow(1 - t, 3);
  const value = from + (to - from) * eased;
  return (
    <div
      className={className}
      style={{
        color,
        fontVariantNumeric: "tabular-nums",
        textShadow: `0 0 60px ${color}55`,
      }}
    >
      {formatGBP(value)}
    </div>
  );
};

// 0:00–0:05  HOOK — big counter to £60.9B
const SceneHook: React.FC = () => (
  <AbsoluteFill className="flex flex-col items-center justify-center px-16 text-center">
    <FadeUp className="mb-8">
      <p
        className="text-6xl font-semibold uppercase tracking-[0.3em]"
        style={{ color: MUTED }}
      >
        UK 2026
      </p>
    </FadeUp>
    <Counter
      from={0}
      to={60_900_000_000}
      duration={SEC(2.5)}
      className="text-[260px] font-black leading-none tracking-tight"
    />
    <FadeUp delay={SEC(2.5)} className="mt-12">
      <p
        className="max-w-[900px] text-6xl font-semibold leading-tight"
        style={{ color: TEXT }}
      >
        in credit card{" "}
        <span style={{ color: DEBT }}>interest</span> Brits will pay
      </p>
    </FadeUp>
  </AbsoluteFill>
);

// 0:05–0:10  Per-adult breakdown
const ScenePerAdult: React.FC<{ perAdult: string }> = ({ perAdult }) => (
  <AbsoluteFill className="flex flex-col items-center justify-center px-16 text-center">
    <FadeUp>
      <p
        className="mb-10 text-6xl font-medium"
        style={{ color: MUTED }}
      >
        That's roughly
      </p>
    </FadeUp>
    <FadeUp delay={SEC(0.4)}>
      <div
        className="text-[240px] font-black leading-none"
        style={{ color: ACCENT, textShadow: `0 0 70px ${ACCENT}55` }}
      >
        {perAdult}
      </div>
    </FadeUp>
    <FadeUp delay={SEC(0.9)} className="mt-10">
      <p className="text-7xl font-semibold" style={{ color: TEXT }}>
        per UK adult.
      </p>
    </FadeUp>
    <FadeUp delay={SEC(1.6)} className="mt-16">
      <p
        className="text-5xl font-medium"
        style={{ color: MUTED }}
      >
        Most of it goes straight to the banks.
      </p>
    </FadeUp>
  </AbsoluteFill>
);

// 0:10–0:17  The reason — APR
const SceneAPR: React.FC<{ apr: string }> = ({ apr }) => (
  <AbsoluteFill className="flex flex-col items-center justify-center px-16 text-center">
    <FadeUp>
      <p
        className="mb-12 text-6xl font-semibold leading-tight"
        style={{ color: TEXT }}
      >
        Why? The average UK
        <br />
        credit card APR is
      </p>
    </FadeUp>
    <FadeUp delay={SEC(0.6)}>
      <div
        className="text-[300px] font-black leading-none"
        style={{ color: DEBT, textShadow: `0 0 80px ${DEBT}66` }}
      >
        {apr}
      </div>
    </FadeUp>
    <FadeUp delay={SEC(1.4)} className="mt-12">
      <p className="text-5xl font-medium" style={{ color: MUTED }}>
        On £1,000, that's £244/yr — for nothing.
      </p>
    </FadeUp>
  </AbsoluteFill>
);

// 0:17–0:32  Two ways out — Avalanche vs Snowball
const SceneTwoWaysOut: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="flex flex-col items-center justify-start px-12 pt-32">
      <FadeUp>
        <p
          className="mb-4 text-6xl font-semibold uppercase tracking-[0.25em]"
          style={{ color: MUTED }}
        >
          Two ways out
        </p>
      </FadeUp>

      <FadeUp delay={SEC(0.4)}>
        <h2
          className="mb-16 text-7xl font-black"
          style={{ color: TEXT }}
        >
          Pick your method.
        </h2>
      </FadeUp>

      {/* Avalanche card */}
      <FadeUp delay={SEC(1)} distance={80}>
        <div
          className="mb-10 w-[920px] rounded-[40px] border p-12"
          style={{
            borderColor: `${MONEY}55`,
            background: "rgba(52,211,153,0.06)",
          }}
        >
          <p
            className="mb-3 text-4xl font-semibold uppercase tracking-[0.2em]"
            style={{ color: MONEY }}
          >
            Avalanche
          </p>
          <p
            className="text-7xl font-black leading-tight"
            style={{ color: TEXT }}
          >
            Highest APR first.
          </p>
          <p
            className="mt-4 text-4xl"
            style={{ color: MUTED }}
          >
            Mathematically the cheapest.
          </p>
        </div>
      </FadeUp>

      {/* Snowball card */}
      <FadeUp delay={SEC(2.4)} distance={80}>
        <div
          className="w-[920px] rounded-[40px] border p-12"
          style={{
            borderColor: `${ACCENT}55`,
            background: "rgba(251,191,36,0.06)",
          }}
        >
          <p
            className="mb-3 text-4xl font-semibold uppercase tracking-[0.2em]"
            style={{ color: ACCENT }}
          >
            Snowball
          </p>
          <p
            className="text-7xl font-black leading-tight"
            style={{ color: TEXT }}
          >
            Smallest balance first.
          </p>
          <p
            className="mt-4 text-4xl"
            style={{ color: MUTED }}
          >
            Best for momentum &amp; willpower.
          </p>
        </div>
      </FadeUp>

      {/* underline highlighter */}
      <FadeUp delay={SEC(4.5)} className="mt-16">
        <p
          className="text-5xl font-semibold"
          style={{ color: TEXT, opacity: Math.min(1, (frame - SEC(4.5)) / 30) }}
        >
          As a CA, I'll show the math.
        </p>
      </FadeUp>
    </AbsoluteFill>
  );
};

// 0:32–0:47  The math — minimum payments vs avalanche on £5k
const SceneMath: React.FC<{ examplePrincipal: string }> = ({
  examplePrincipal,
}) => (
  <AbsoluteFill className="flex flex-col items-center justify-center px-12 text-center">
    <FadeUp>
      <p className="mb-6 text-5xl font-medium" style={{ color: MUTED }}>
        On {examplePrincipal} at 24.4%
      </p>
    </FadeUp>

    <FadeUp delay={SEC(0.5)}>
      <div
        className="mb-16 w-[940px] rounded-[36px] border p-10 text-left"
        style={{
          borderColor: `${DEBT}66`,
          background: "rgba(248,113,113,0.07)",
        }}
      >
        <p
          className="mb-2 text-4xl font-semibold uppercase tracking-[0.2em]"
          style={{ color: DEBT }}
        >
          Minimums only
        </p>
        <p
          className="text-7xl font-black leading-tight"
          style={{ color: TEXT }}
        >
          ~24 years
        </p>
        <p className="mt-3 text-4xl" style={{ color: MUTED }}>
          ~£7,400 in interest paid.
        </p>
      </div>
    </FadeUp>

    <FadeUp delay={SEC(2)} distance={60}>
      <div
        className="w-[940px] rounded-[36px] border p-10 text-left"
        style={{
          borderColor: `${MONEY}66`,
          background: "rgba(52,211,153,0.08)",
        }}
      >
        <p
          className="mb-2 text-4xl font-semibold uppercase tracking-[0.2em]"
          style={{ color: MONEY }}
        >
          Avalanche, £200/mo
        </p>
        <p
          className="text-7xl font-black leading-tight"
          style={{ color: TEXT }}
        >
          ~3 years
        </p>
        <p className="mt-3 text-4xl" style={{ color: MUTED }}>
          ~£1,900 in interest. Saves ~£5.5k.
        </p>
      </div>
    </FadeUp>

    <FadeUp delay={SEC(4)} className="mt-14">
      <p
        className="text-5xl font-semibold"
        style={{ color: ACCENT }}
      >
        Same debt. Same income. Different math.
      </p>
    </FadeUp>
  </AbsoluteFill>
);

// 0:47–0:55  Takeaway
const SceneTakeaway: React.FC = () => (
  <AbsoluteFill className="flex flex-col items-center justify-center px-16 text-center">
    <FadeUp>
      <p className="text-6xl font-semibold" style={{ color: MUTED }}>
        The lesson:
      </p>
    </FadeUp>
    <FadeUp delay={SEC(0.5)} className="mt-8">
      <p
        className="text-[110px] font-black leading-[1.05]"
        style={{ color: TEXT }}
      >
        Pay yourself
        <br />
        <span style={{ color: MONEY }}>before</span> your bank.
      </p>
    </FadeUp>
  </AbsoluteFill>
);

// 0:55–1:00  CTA + CA stamp
const SceneCTA: React.FC<{ ca: string }> = ({ ca }) => (
  <AbsoluteFill className="flex flex-col items-center justify-center px-16 text-center">
    <FadeUp>
      <div
        className="mb-10 inline-flex items-center gap-4 rounded-full border px-8 py-4"
        style={{ borderColor: `${MONEY}88`, color: MONEY }}
      >
        <span className="text-4xl font-bold tracking-[0.3em]">{ca}</span>
      </div>
    </FadeUp>
    <FadeUp delay={SEC(0.4)}>
      <p
        className="text-[110px] font-black leading-[1] tracking-tight"
        style={{ color: TEXT }}
      >
        Follow for
        <br />
        <span style={{ color: MONEY }}>CA-backed</span>
        <br />
        UK finance.
      </p>
    </FadeUp>
    <FadeUp delay={SEC(1.2)} className="mt-12">
      <p className="text-4xl font-medium" style={{ color: MUTED }}>
        New videos: Wed · Fri · Sun
      </p>
    </FadeUp>
  </AbsoluteFill>
);

// Progress bar at the bottom — gives the Short a "watch me" pull
const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const w = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: "clamp",
  });
  return (
    <div className="absolute inset-x-0 bottom-0 h-3" style={{ background: "#1a201d" }}>
      <div
        className="h-full"
        style={{ width: `${w}%`, background: MONEY }}
      />
    </div>
  );
};

export const CreditCardDebt: React.FC<Props> = ({
  ca,
  perAdult,
  apr,
  examplePrincipal,
}) => {
  return (
    <AbsoluteFill style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <Backdrop />
      <Grain />

      <Sequence from={0} durationInFrames={SEC(5)}>
        <SceneHook />
      </Sequence>

      <Sequence from={SEC(5)} durationInFrames={SEC(5)}>
        <ScenePerAdult perAdult={perAdult} />
      </Sequence>

      <Sequence from={SEC(10)} durationInFrames={SEC(7)}>
        <SceneAPR apr={apr} />
      </Sequence>

      <Sequence from={SEC(17)} durationInFrames={SEC(15)}>
        <SceneTwoWaysOut />
      </Sequence>

      <Sequence from={SEC(32)} durationInFrames={SEC(15)}>
        <SceneMath examplePrincipal={examplePrincipal} />
      </Sequence>

      <Sequence from={SEC(47)} durationInFrames={SEC(8)}>
        <SceneTakeaway />
      </Sequence>

      <Sequence from={SEC(55)} durationInFrames={SEC(5)}>
        <SceneCTA ca={ca} />
      </Sequence>

      <ProgressBar />
    </AbsoluteFill>
  );
};
