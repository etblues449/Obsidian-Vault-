/* eslint-disable react/no-unescaped-entities */
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Faceless Finance App — production cockpit for a CA-led faceless personal-finance YouTube channel.
 * Single-file React component. Drop-in for a Claude.ai artifact or a Vite/CRA App.jsx.
 * Rebuilt from the 10 reference screenshots — see "Faceless Finance App Spec.md".
 *
 * Screens: Dashboard · Channel ROI & Analytics · AI Provider Performance Analytics ·
 * Video Creator · Live Events · Script Editor & Storyboard Tune · Batch Approval Review Feed ·
 * Bulk Actions · Fallback Sandbox · Smart Fallback Rule Builder.
 *
 * Visual pass: Material-3 / Google-Stitch-flavoured — pill buttons, soft elevation, tonal surfaces.
 */
const APP_NAME = "Faceless Finance App";

/* ───────────────────────── design tokens ───────────────────────── */
const C = {
  bg: "#06090F",
  surface: "#0B111C",
  card: "#141B29",
  cardAlt: "#1A2333",
  cardHi: "#232E42",
  border: "#28344B",
  borderHi: "#3A4663",
  accent: "#27E8A4",
  accentDim: "rgba(39,232,164,0.14)",
  accentSoft: "rgba(39,232,164,0.30)",
  blue: "#5B8DEF",
  blueDim: "rgba(91,141,239,0.18)",
  gold: "#F5C544",
  goldDim: "rgba(245,197,68,0.16)",
  purple: "#B197FC",
  purpleDim: "rgba(177,151,252,0.18)",
  red: "#F2606A",
  redDim: "rgba(242,96,106,0.16)",
  text: "#EAEEF6",
  textDim: "#97A3BA",
  muted: "#5F6C86",
  white: "#fff",
  elev1: "0 1px 2px rgba(0,0,0,.30), 0 1px 8px rgba(0,0,0,.20)",
  elev2: "0 4px 14px rgba(0,0,0,.34)",
};

const FONT = "'Google Sans Text', 'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace";

/* ───────────────────────── helpers ───────────────────────── */
const fmtClock = (s) => {
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (d > 0) return `${d} Day${d > 1 ? "s" : ""}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const gbp = (n) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uid = () => Math.random().toString(36).slice(2, 9);
const ts = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;

/* ───────────────────────── seed data ───────────────────────── */
const PROVIDERS0 = [
  { id: "runway", name: "Runway Gen-4", short: "Runway Gen-3", glyph: "🅡", color: "#22E5A0", successRate: 92, costPerMin: 4.5, quality: 9.2, renderTime: "3m 45s", costPerSec: 0.075, adherence: 88, reliability: 99.8, relGood: true, fallbackOnError: true, fallbackOnLatency: true, role: "Active (Primary)", est: "Estimated latency: <5s" },
  { id: "veo", name: "Veo 3", short: "Veo 3", glyph: "🅥", color: "#3B82F6", successRate: 85, costPerMin: 3.8, quality: 8.3, renderTime: "4m 10s", costPerSec: 0.063, adherence: 82, reliability: 98.5, relGood: true, fallbackOnError: true, fallbackOnLatency: false, role: "Ready (Backup)" },
  { id: "heygen", name: "HeyGen", short: "HeyGen", glyph: "🅗", color: "#A78BFA", successRate: 95, costPerMin: 5.1, quality: 9.0, renderTime: "2m 30s", costPerSec: 0.085, adherence: 94, reliability: 99.9, relGood: true, fallbackOnError: true, fallbackOnLatency: false, role: "Ready (Backup)" },
  { id: "falai", name: "Fal.ai", short: "Fal.ai", glyph: "🅕", color: "#F59E0B", successRate: 78, costPerMin: 2.2, quality: 7.4, renderTime: "5m 20s", costPerSec: 0.036, adherence: 75, reliability: 95.0, relGood: false, fallbackOnError: true, fallbackOnLatency: false, role: "Ready (Backup)" },
];

const QUEUE0 = [
  { id: "q1", title: "'5 UK Tax Hacks'", platform: "tiktok", type: "Automated", secondsLeft: 14 * 60 + 25 },
  { id: "q2", title: "'Understanding ISAs'", platform: "reels", type: "Automated", secondsLeft: 4 * 3600 + 30 * 60 + 10 },
  { id: "q3", title: "'Pension Basics'", platform: "youtube", type: "Scheduled", secondsLeft: 36 * 3600 },
];

const PROJECTS0 = [
  { id: "p1", title: "Pension Reform 2024: What It Means for You", stage: "Idea", priority: "High", providers: [], emoji: "💡", meta: "AI Draft (Idea)" },
  { id: "p2", title: "Top 5 ISA Providers", stage: "Idea", priority: "Medium", providers: [], emoji: "💡", meta: "AI Draft (Idea)" },
  { id: "p3", title: "Understanding Capital Gains Tax", stage: "Script", priority: "High", providers: [], emoji: "📜", meta: "AI Scripting (Script)" },
  { id: "p4", title: "Crypto for Beginners Guide", stage: "Script", priority: "Medium", providers: [], emoji: "📜", meta: "AI Scripting (Script)" },
  { id: "p5", title: "How to Budget with Inflation", stage: "Render", priority: "High", providers: ["AWS", "GCP"], emoji: "🎬", meta: "Rendering (Render) | Multi-Provider: AWS/GCP" },
  { id: "p6", title: "Debt Consolidation Strategies", stage: "Render", priority: "Medium", providers: ["Azure", "AWS"], emoji: "🎬", meta: "Rendering (Render) | Multi-Provider: Azure/AWS" },
  { id: "p7", title: "Pension Basics for Q4", stage: "Approval", priority: "High", providers: ["Runway"], emoji: "✅", meta: "Awaiting approval (Approval)" },
];

const REVIEWS0 = [
  { id: "r1", title: "Understanding Capital Gains Tax for UK Creators", source: "UK Personal Finance", thumb: "💷", decision: null },
  { id: "r2", title: "ISA Allowance 2026: Use It or Lose It", source: "UK Personal Finance", thumb: "🧾", decision: null },
  { id: "r3", title: "Why Your Pension Is Quietly Losing Money", source: "UK Personal Finance", thumb: "📉", decision: null },
  { id: "r4", title: "Side Hustle Tax: What HMRC Actually Wants", source: "UK Personal Finance", thumb: "💼", decision: null },
  { id: "r5", title: "The £20k ISA Strategy Nobody Talks About", source: "UK Personal Finance", thumb: "🏦", decision: null },
  { id: "r6", title: "Salary Sacrifice: Free Money You're Ignoring", source: "UK Personal Finance", thumb: "📊", decision: null },
  { id: "r7", title: "Premium Bonds vs Savings: The Real Maths", source: "UK Personal Finance", thumb: "🎲", decision: null },
  { id: "r8", title: "First-Time Buyer ISAs Explained in 60s", source: "UK Personal Finance", thumb: "🏠", decision: null },
  { id: "r9", title: "Capital Gains Tax Changes — Act Before April", source: "UK Personal Finance", thumb: "📅", decision: null },
  { id: "r10", title: "Emergency Fund: How Much Is Actually Enough?", source: "UK Personal Finance", thumb: "🛟", decision: null },
];

const SCENES0 = [
  { id: "s1", label: "Intro", durationSec: 15, status: "done", prompt: 'Professional British finance presenter, modern studio, warm lighting, "ISA" text overlay. [Sync: Locked]', topic: "Scene 1: Intro" },
  { id: "s2", label: "The Problem", durationSec: 30, status: "done", prompt: "Presenter with animated graph overlay, blue background, clear text graphics. [Sync: Locked]", topic: "Scene 2: ISA Rules Explained" },
  { id: "s3", label: "Case Study", durationSec: 20, status: "error", prompt: "B-roll of UK high street + over-shoulder laptop showing a savings dashboard. [Sync: Locked]", topic: "Scene 3: Case Study" },
  { id: "s4", label: "Expert Tip", durationSec: 25, status: "done", prompt: "Close-up of hands writing on a notepad titled 'Capital Gains'. [Sync: Locked]", topic: "Scene 4: Expert Tip" },
  { id: "s5", label: "Solution", durationSec: 40, status: "done", prompt: "£20 notes fanned on a desk next to a calculator, soft focus. [Sync: Locked]", topic: "Scene 5: Solution" },
  { id: "s6", label: "Data Analysis", durationSec: 35, status: "processing", prompt: "Presenter beside a wall of live market charts, cool studio lighting. [Sync: Locked]", topic: "Scene 6: Data Analysis" },
  { id: "s7", label: "Pension Math", durationSec: 28, status: "done", prompt: "Animated compound-interest curve, presenter pointing, '£' particles. [Sync: Locked]", topic: "Scene 7: Pension Math" },
  { id: "s8", label: "Common Mistakes", durationSec: 22, status: "done", prompt: "Split-screen 'before / after' contributions, red→green colour shift. [Sync: Locked]", topic: "Scene 8: Common Mistakes" },
  { id: "s9", label: "Q4 Action Plan", durationSec: 24, status: "done", prompt: "Checklist overlay, presenter ticking items, calendar showing April. [Sync: Locked]", topic: "Scene 9: Q4 Action Plan" },
  { id: "s10", label: "Recap", durationSec: 18, status: "done", prompt: "Presenter, three bullet text overlays summarising key points. [Sync: Locked]", topic: "Scene 10: Recap" },
  { id: "s11", label: "Outro", durationSec: 12, status: "queued", prompt: "Presenter to camera, subscribe button animation lower-third. [Sync: Locked]", topic: "Scene 11: Outro" },
  { id: "s12", label: "End Card", durationSec: 8, status: "queued", prompt: "Channel end-card, two video thumbnails, soft music bed. [Sync: Locked]", topic: "Scene 12: End Card" },
];

const SCRIPT0 = `Welcome back, [Emphasis: Strong] savvy investors!

Today we're diving into the new UK ISA rules [Speed: Fast, Pitch: High].

Remember, your annual allowance [Speed: Slow] is now £20,000.

A Stocks and Shares ISA shelters your gains [Emphasis: Strong] from Capital Gains Tax — completely.

If you only do one thing this tax year, [Pitch: High] use the allowance before it resets in April.

That's it for today, savvy investors — like, subscribe, and I'll see you Wednesday.`;

const LOG0 = [
  { ts: "10:31:45.230", level: "ORCHESTRATE", message: "Initializing AI Script Generation for 'Retirement Planning' video.", payload: { step: "script.init", topic: "Retirement Planning" } },
  { ts: "10:32:15.415", level: "SUCCESS", message: "Script Generated. Word count: 1200. Ready for review.", payload: { step: "script.done", words: 1200 } },
  { ts: "10:32:48.112", level: "ERROR", message: "Voiceover synthesis failed. API connection timeout.", payload: { step: "voiceover", error: "ETIMEDOUT", provider: "elevenlabs" }, retryable: true },
  { ts: "10:33:05.550", level: "ORCHESTRATE", message: "Retrying Voiceover synthesis...", payload: { step: "voiceover.retry", attempt: 2 } },
  { ts: "10:33:22.890", level: "SUCCESS", message: "Voiceover synthesis complete. File saved.", payload: { step: "voiceover.done", file: "vo_retirement_v1.mp3" } },
  { ts: "10:34:10.645", level: "ORCHESTRATE", message: "Assembling video clips from library.", payload: { step: "assemble.init" } },
  { ts: "10:34:55.310", level: "ERROR", message: "Clip 'chart_animation_v3.mp4' not found in assets.", payload: { step: "assemble", error: "ENOENT", asset: "chart_animation_v3.mp4" }, retryable: true },
];

const RULES0 = [
  { id: "rule1", ifText: "scene movement > 5 (High Motion)", thenProviderId: "runway" },
  { id: "rule2", ifText: "scene type is Talking Head", thenProviderId: "heygen" },
];

const SCENARIOS = {
  runwayCredits: { label: "Runway Out of Credits", primaryError: "Error: Out of Credits", catchAt: 0, cost: 12.5, time: "2m 35s", quality: "Medium (720p)" },
  veoLatency: { label: "Veo 3 High Latency", primaryError: "Error: Latency > 60s", catchAt: 1, cost: 14.2, time: "3m 05s", quality: "High (1080p)" },
  apiTimeout: { label: "API Timeout", primaryError: "Error: Gateway Timeout", catchAt: 0, cost: 11.8, time: "2m 50s", quality: "Medium (720p)" },
};

/* ───────────────────────── tiny UI atoms ───────────────────────── */
const Pill = ({ children, bg = C.cardAlt, color = C.textDim, style }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", padding: "3px 8px", borderRadius: 999, background: bg, color, textTransform: "uppercase", ...style }}>{children}</span>
);

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, boxShadow: C.elev1, ...style }}>{children}</div>
);

const Eyebrow = ({ children, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".09em", color: C.muted, textTransform: "uppercase" }}>{children}</div>
    {right}
  </div>
);

const Btn = ({ children, onClick, variant = "primary", size = "md", color, full, style, disabled }) => {
  const base = {
    border: "none", cursor: disabled ? "default" : "pointer", fontWeight: 600, fontFamily: FONT, letterSpacing: ".01em",
    borderRadius: 999, transition: "transform .08s, filter .15s", opacity: disabled ? 0.5 : 1,
    padding: size === "sm" ? "7px 14px" : size === "lg" ? "14px 22px" : "11px 18px",
    fontSize: size === "sm" ? 12 : size === "lg" ? 15 : 13.5,
    width: full ? "100%" : "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
  };
  const v =
    variant === "primary" ? { background: color || C.accent, color: "#062417", boxShadow: C.elev1 }
    : variant === "blue" ? { background: C.blue, color: C.white, boxShadow: C.elev1 }
    : variant === "danger" ? { background: C.redDim, color: C.red, border: `1px solid ${C.red}` }
    : variant === "ghost" ? { background: "transparent", color: color || C.textDim }
    : variant === "outline" ? { background: "transparent", color: color || C.accent, border: `1px solid ${color || C.accent}` }
    : { background: C.cardAlt, color: C.text };
  return <button disabled={disabled} onClick={onClick} style={{ ...base, ...v, ...style }} onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "scale(0.97)")} onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>{children}</button>;
};

const Toggle = ({ on, onChange }) => (
  <div onClick={() => onChange(!on)} style={{ width: 42, height: 24, borderRadius: 999, background: on ? C.accent : C.cardHi, position: "relative", cursor: "pointer", transition: "background .15s", flexShrink: 0 }}>
    <div style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: C.white, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.4)" }} />
  </div>
);

const Slider = ({ value, min, max, step = 1, onChange, accent = C.blue }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: "100%", appearance: "none", height: 6, borderRadius: 999, outline: "none", background: `linear-gradient(90deg, ${accent} ${pct}%, ${C.cardHi} ${pct}%)`, accentColor: accent }} />
  );
};

const ProgressBar = ({ pct, color = C.accent, h = 6 }) => (
  <div style={{ height: h, borderRadius: 999, background: C.cardHi, overflow: "hidden" }}>
    <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 999, transition: "width .3s" }} />
  </div>
);

const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 19, fontWeight: 800 }}>{children}</div>
    {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{sub}</div>}
  </div>
);

const PlatIcon = ({ p, size = 30 }) => {
  const map = {
    tiktok: { bg: "#000", el: <span style={{ fontWeight: 800, fontSize: size * 0.5, color: "#fff" }}>♪</span> },
    reels: { bg: "linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)", el: <span style={{ fontSize: size * 0.5 }}>▶</span> },
    youtube: { bg: "#FF0000", el: <span style={{ color: "#fff", fontSize: size * 0.5 }}>▶</span> },
  }[p] || { bg: C.cardAlt, el: "?" };
  return <div style={{ width: size, height: size, borderRadius: 8, background: map.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{map.el}</div>;
};

const Toast = ({ msg }) =>
  msg ? (
    <div style={{ position: "absolute", left: "50%", bottom: 92, transform: "translateX(-50%)", background: "#0a0f1c", border: `1px solid ${C.accentSoft}`, color: C.text, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 90, boxShadow: "0 8px 30px rgba(0,0,0,.5)", whiteSpace: "nowrap" }}>{msg}</div>
  ) : null;

/* ───────────────────────── header bars ───────────────────────── */
const TopBar = ({ title, onBack, right, accentRight }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px 16px" }}>
    {onBack ? (
      <div onClick={onBack} style={{ width: 34, height: 34, borderRadius: 10, background: C.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: C.text }}>‹</div>
    ) : <div style={{ width: 4 }} />}
    <div style={{ flex: 1, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>{title}</div>
    {right ? <div style={{ color: accentRight ? C.blue : C.textDim, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>{right}</div> : null}
  </div>
);

/* ════════════════════════════════════════════════════════════════
   SCREEN: Dashboard
   ════════════════════════════════════════════════════════════════ */
function QueueCard({ queue }) {
  return (
    <Card>
      <Eyebrow>Publishing Queue</Eyebrow>
      {queue.map((q, i) => (
        <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: i < queue.length - 1 ? `1px solid ${C.border}` : "none" }}>
          <PlatIcon p={q.platform} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.title} <span style={{ color: C.muted, fontWeight: 400 }}>· {q.platform === "youtube" ? "YouTube" : q.platform === "reels" ? "Reels" : "TikTok"}</span></div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{q.type}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: C.muted }}>Live in:</div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: MONO, color: q.secondsLeft < 3600 ? C.accent : C.text }}>{fmtClock(q.secondsLeft)}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function Dashboard({ go, queue, projects }) {
  const inPipe = projects.length;
  return (
    <div>
      <SectionTitle sub="Your AI video production cockpit · CA-led · UK">{APP_NAME}</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { num: "1.4K", label: "Subscribers", delta: "+480 / mo", c: C.accent },
          { num: "92K", label: "Total Views", delta: "+18K / mo", c: C.accent },
          { num: inPipe, label: "In Pipeline", delta: "1 rendering", c: C.gold },
        ].map((k) => (
          <Card key={k.label} style={{ padding: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{k.num}</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: k.c, fontWeight: 700, marginTop: 5 }}>{k.delta}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow>Monthly Goal Progress</Eyebrow>
        {[
          { label: "Subscribers", cur: 1420, goal: 2000, c: C.accent },
          { label: "Views", cur: 92000, goal: 120000, c: C.blue },
          { label: "Videos shipped", cur: 4, goal: 8, c: C.gold },
        ].map((g) => (
          <div key={g.label} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: C.textDim }}>{g.label}</span>
              <span>{g.cur.toLocaleString()} / {g.goal.toLocaleString()}</span>
            </div>
            <ProgressBar pct={(g.cur / g.goal) * 100} color={g.c} />
          </div>
        ))}
      </Card>

      <div style={{ marginBottom: 14 }}><QueueCard queue={queue} /></div>

      <Card>
        <Eyebrow>Jump to</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { t: "Video Creator", d: "Pension Basics for Q4 · 75%", go: () => go("studio"), c: C.accent },
            { t: "Batch Approval", d: "3 / 10 reviewed", go: () => go("projects", "review"), c: C.gold },
            { t: "Bulk Actions", d: "7 items selected", go: () => go("projects", "bulk"), c: C.blue },
            { t: "Fallback Sandbox", d: "Test provider failover", go: () => go("providers", "sandbox"), c: C.purple },
          ].map((q) => (
            <div key={q.t} onClick={q.go} style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, cursor: "pointer" }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: q.c, marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 700 }}>{q.t}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{q.d}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SCREEN: Analytics → Channel ROI  +  AI Provider Performance
   ════════════════════════════════════════════════════════════════ */
function HeatGrid({ title, seed }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const cols = ["9h", "12h", "15h", "18h", "21h"];
  const heat = (r, c) => {
    const v = (Math.sin((r + 1) * 12.9898 + (c + 1) * 78.233 + seed) * 43758.5453) % 1;
    return Math.abs(v);
  };
  const col = (v) => (v < 0.2 ? "#1e3b2e" : v < 0.4 ? "#2f5f3a" : v < 0.6 ? "#c98a3a" : v < 0.8 ? "#d65a2a" : "#9b1c1c");
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textAlign: "center", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", gap: 2 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, justifyContent: "space-between" }}>
          {days.map((d) => <div key={d} style={{ fontSize: 8, color: C.muted, height: 12, lineHeight: "12px" }}>{d}</div>)}
        </div>
        <div style={{ flex: 1 }}>
          {days.map((_, r) => (
            <div key={r} style={{ display: "flex", gap: 2, marginBottom: 2 }}>
              {cols.map((_, c) => <div key={c} style={{ flex: 1, height: 12, borderRadius: 2, background: col(heat(r, c)) }} />)}
            </div>
          ))}
          <div style={{ display: "flex", gap: 2, marginTop: 1 }}>
            {cols.map((c) => <div key={c} style={{ flex: 1, fontSize: 7, color: C.muted, textAlign: "center" }}>{c}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function LineAreaChart() {
  // Cost (£, red) vs Views/Revenue (k, green) over 8 points, y 0–20
  const pts = [
    { x: "12 Jun", cost: 3, rev: 6 }, { x: "13 Jul", cost: 4, rev: 14 }, { x: "16 Aug", cost: 5, rev: 9 },
    { x: "1 Sep", cost: 6, rev: 4 }, { x: "14 Sep", cost: 16, rev: 5 }, { x: "20 Sep", cost: 11, rev: 8 },
    { x: "22 Oct", cost: 5, rev: 14 }, { x: "23 Nov", cost: 4, rev: 18 },
  ];
  const W = 280, H = 120, pad = 4;
  const X = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const Y = (v) => H - pad - (v / 20) * (H - pad * 2);
  const path = (key) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(" ");
  const area = (key) => `${path(key)} L${X(pts.length - 1)},${H - pad} L${X(0)},${H - pad} Z`;
  return (
    <div>
      <div style={{ display: "flex", gap: 14, fontSize: 11, marginBottom: 8 }}>
        <span style={{ color: C.red }}>■ Cost (£)</span><span style={{ color: C.accent }}>■ Views / Revenue (k)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 120 }}>
        {[0, 5, 10, 15, 20].map((g) => (
          <g key={g}>
            <line x1={pad} x2={W - pad} y1={Y(g)} y2={Y(g)} stroke={C.border} strokeWidth="0.5" />
            <text x={0} y={Y(g) - 2} fontSize="7" fill={C.muted}>£{g}</text>
          </g>
        ))}
        <path d={area("rev")} fill="rgba(34,229,160,0.18)" />
        <path d={area("cost")} fill="rgba(242,84,91,0.16)" />
        <path d={path("rev")} fill="none" stroke={C.accent} strokeWidth="2" />
        <path d={path("cost")} fill="none" stroke={C.red} strokeWidth="2" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: C.muted, marginTop: 2 }}>
        {pts.map((p) => <span key={p.x}>{p.x}</span>)}
      </div>
    </div>
  );
}

function ChannelROI({ queue }) {
  return (
    <div>
      <Card style={{ marginBottom: 14, background: "linear-gradient(135deg,#10261e,#141c2e)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>Estimated Tax Saved</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.accent, margin: "4px 0" }}>{gbp(4250)} <span style={{ fontSize: 16 }}>↗</span></div>
            <div style={{ fontSize: 12, color: C.muted, maxWidth: 200 }}>Based on Self-Assessment contributions from video topics.</div>
          </div>
          <div style={{ fontSize: 40 }}>🐷</div>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow>Engagement Heatmap · Last 7 Days</Eyebrow>
        <div style={{ display: "flex", gap: 14 }}>
          <HeatGrid title="TikTok" seed={1.7} />
          <HeatGrid title="Reels" seed={4.2} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
          <span style={{ fontSize: 9, color: C.muted }}>Low</span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: "linear-gradient(90deg,#1e3b2e,#2f5f3a,#c98a3a,#d65a2a,#9b1c1c)" }} />
          <span style={{ fontSize: 9, color: C.muted }}>High</span>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow>Cost vs Performance · GBP</Eyebrow>
        <LineAreaChart />
      </Card>

      <QueueCard queue={queue} />
    </div>
  );
}

function ProviderPerf({ providers }) {
  const [range, setRange] = useState("7d");
  const order = ["runway", "veo", "falai", "heygen"];
  const list = order.map((id) => providers.find((p) => p.id === id));
  const trend = (v, up) => <span style={{ color: up ? C.accent : C.red, fontSize: 10 }}>{up ? "↗" : "↘"} {v}</span>;
  return (
    <div>
      <div style={{ display: "flex", background: C.cardAlt, borderRadius: 12, padding: 4, marginBottom: 14 }}>
        {[["24h", "Last 24h"], ["7d", "7 Days"], ["30d", "30 Days"]].map(([k, l]) => (
          <div key={k} onClick={() => setRange(k)} style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: range === k ? C.blue : "transparent", color: range === k ? C.white : C.textDim }}>{l}</div>
        ))}
      </div>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow>Success Rate</Eyebrow>
        {list.map((p) => (
          <div key={p.id} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, marginBottom: 5 }}>{p.name}</div>
            <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${p.successRate}%`, background: C.accent, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, fontSize: 11, fontWeight: 800, color: "#062417" }}>{p.successRate}%</div>
              <div style={{ width: `${100 - p.successRate}%`, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#3a0c0c" }}>{100 - p.successRate}%</div>
            </div>
          </div>
        ))}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow>Cost vs Quality</Eyebrow>
        <svg viewBox="0 0 280 150" style={{ width: "100%", height: 150 }}>
          {[0, 2, 4, 6].map((g) => <g key={g}><line x1="22" x2="276" y1={130 - (g / 6) * 110} y2={130 - (g / 6) * 110} stroke={C.border} strokeWidth="0.5" /><text x="0" y={134 - (g / 6) * 110} fontSize="8" fill={C.muted}>{g}</text></g>)}
          {[5, 6, 7, 8, 9, 10].map((g) => <g key={g}><line x1={22 + ((g - 5) / 5) * 254} x2={22 + ((g - 5) / 5) * 254} y1="20" y2="130" stroke={C.border} strokeWidth="0.5" /><text x={22 + ((g - 5) / 5) * 254 - 3} y="144" fontSize="8" fill={C.muted}>{g}</text></g>)}
          {list.map((p) => {
            const cx = 22 + ((p.quality - 5) / 5) * 254;
            const cy = 130 - (p.costPerMin / 6) * 110;
            return (
              <g key={p.id}>
                <circle cx={cx} cy={cy} r="9" fill={p.color} />
                <text x={cx} y={cy + 3.5} fontSize="9" fill="#0a0f1c" textAnchor="middle" fontWeight="bold">{p.glyph}</text>
                <text x={cx + 12} y={cy - 1} fontSize="8.5" fill={C.text} fontWeight="bold">{p.name}</text>
                <text x={cx + 12} y={cy + 8} fontSize="7.5" fill={C.muted}>Cost: {gbp(p.costPerMin)}</text>
              </g>
            );
          })}
          <text x="150" y="150" fontSize="8" fill={C.muted} textAnchor="middle">Quality Score (1–10)</text>
        </svg>
        <div style={{ fontSize: 8, color: C.muted, textAlign: "center", marginTop: 2 }}>↕ Cost per Minute (£)</div>
      </Card>

      <Card>
        <Eyebrow>Provider Comparison</Eyebrow>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ color: C.muted, textAlign: "left" }}>
                <th style={{ padding: "6px 4px" }}>Provider</th><th>Render</th><th>£/sec</th><th>Adher.</th><th>API</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "8px 4px", fontWeight: 700 }}>{p.name}</td>
                  <td>{p.renderTime}<br />{trend(`${(4 + i).toFixed(1)}%`, i % 2 === 0)}</td>
                  <td>{gbp(p.costPerSec).replace("£", "£")}<br />{trend(`${(0.05 - i * 0.01).toFixed(2)}`, false)}</td>
                  <td>{p.adherence}%<br />{trend(`${p.adherence}%`, p.relGood)}</td>
                  <td><Pill bg={p.relGood ? C.accentDim : C.goldDim} color={p.relGood ? C.accent : C.gold}>{p.relGood ? "✓" : "⚠"} {p.reliability}%</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AnalyticsTab({ queue, providers }) {
  const [view, setView] = useState("roi");
  return (
    <div>
      <TopBar title={view === "roi" ? "Channel ROI & Analytics" : "AI Provider Performance"} right={<span style={{ fontSize: 18 }}>⌕</span>} />
      <div style={{ display: "flex", background: C.cardAlt, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {[["roi", "Channel ROI"], ["providers", "AI Providers"]].map(([k, l]) => (
          <div key={k} onClick={() => setView(k)} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", background: view === k ? C.accent : "transparent", color: view === k ? "#062417" : C.textDim }}>{l}</div>
        ))}
      </div>
      {view === "roi" ? <ChannelROI queue={queue} /> : <ProviderPerf providers={providers} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SCREEN: Studio → Video Creator + Live Events + Script/Storyboard
   ════════════════════════════════════════════════════════════════ */
function CircleProgress({ pct, sub }) {
  const r = 54, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 150, height: 150, margin: "0 auto" }}>
      <svg viewBox="0 0 130 130" style={{ width: 150, height: 150, transform: "rotate(-90deg)" }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke={C.cardHi} strokeWidth="9" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={C.accent} strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .4s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.accent }}>{pct}%</div>
        <div style={{ fontSize: 12, color: C.textDim }}>Rendered</div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function SceneThumb({ scene, idx, onRetry }) {
  const ring = scene.status === "error" ? C.red : scene.status === "processing" ? C.blue : scene.status === "done" ? C.accent : C.border;
  return (
    <div style={{ width: 86, flexShrink: 0 }}>
      <div style={{ width: 86, height: 132, borderRadius: 10, border: `2px solid ${ring}`, background: C.cardAlt, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 4, left: 4, fontSize: 8, background: "rgba(0,0,0,.5)", borderRadius: 4, padding: "1px 4px", color: "#fff" }}>9:16</div>
        {scene.status === "error" ? <span style={{ fontSize: 26 }}>⚠️</span>
          : scene.status === "processing" ? <span style={{ fontSize: 22, animation: "spin 1s linear infinite" }}>◌</span>
          : scene.status === "done" ? <span style={{ fontSize: 26 }}>🎞️</span>
          : <span style={{ fontSize: 22, opacity: .4 }}>▢</span>}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 5 }}>Scene {idx + 1}</div>
      <div style={{ fontSize: 9.5, color: C.muted }}>{scene.label} ({mmss(scene.durationSec)})</div>
      {scene.status === "error" && <div onClick={onRetry} style={{ marginTop: 4, fontSize: 9.5, fontWeight: 700, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, padding: "3px 0", textAlign: "center", cursor: "pointer" }}>Quick Retry</div>}
      {scene.status === "processing" && <div style={{ marginTop: 4, fontSize: 9, color: C.blue, textAlign: "center" }}>Processing…</div>}
    </div>
  );
}

function VideoCreator({ go, scenes, setScenes, pushLog }) {
  const total = scenes.reduce((a, s) => a + s.durationSec, 0);
  const done = scenes.filter((s) => s.status === "done").length;
  const processingIdx = scenes.findIndex((s) => s.status === "processing");
  const pct = Math.round(((done + (processingIdx >= 0 ? 0.5 : 0)) / scenes.length) * 100);
  const retry = (id) => {
    setScenes((sc) => sc.map((s) => (s.id === id ? { ...s, status: "processing" } : s)));
    pushLog("ORCHESTRATE", `Quick retry: re-rendering ${scenes.find((s) => s.id === id)?.topic}.`, { step: "scene.retry", scene: id });
    setTimeout(() => {
      setScenes((sc) => sc.map((s) => (s.id === id ? { ...s, status: "done" } : s)));
      pushLog("SUCCESS", `Scene rendered: ${scenes.find((s) => s.id === id)?.topic}.`, { step: "scene.done", scene: id });
    }, 2200);
  };
  return (
    <div>
      <TopBar title={`Video Creator: "Pension Basics for Q4"`} onBack={() => go("dashboard")} />
      <Card style={{ marginBottom: 14, textAlign: "center" }}>
        <CircleProgress pct={pct} sub="Est. Time: 4m 15s" />
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14, fontSize: 11.5 }}>
          <div><div style={{ color: C.muted }}>Scene {Math.min(processingIdx + 1 || done + 1, scenes.length)} of {scenes.length}</div><div style={{ color: C.accent, fontWeight: 700 }}>Processing</div></div>
          <div><div style={{ color: C.muted }}>Total Duration</div><div style={{ fontWeight: 700 }}>{mmss(total)}</div></div>
          <div><div style={{ color: C.muted }}>Render Cost</div><div style={{ fontWeight: 700, color: C.accent }}>$4.25</div></div>
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow>Scene-by-Scene Timeline</Eyebrow>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {scenes.map((s, i) => <SceneThumb key={s.id} scene={s} idx={i} onRetry={() => retry(s.id)} />)}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow>Instant Preview</Eyebrow>
        <div style={{ borderRadius: 12, background: "linear-gradient(135deg,#0c1626,#172033)", padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 40%, rgba(34,229,160,.1), transparent 60%)" }} />
          <div style={{ position: "relative", textAlign: "center", padding: "16px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px solid ${C.accent}`, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: C.accent }}>▶</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 10 }}>Previewing Scene 5–6</div>
          </div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 22, position: "relative" }}>
            {Array.from({ length: 48 }).map((_, i) => <div key={i} style={{ flex: 1, height: `${20 + Math.abs(Math.sin(i * 0.7)) * 60}%`, background: i < 24 ? C.accent : C.cardHi, borderRadius: 1, opacity: i < 24 ? 0.7 : 0.4 }} />)}
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn full variant="card" onClick={() => go("studio", "script")}>✎ Script & Storyboard</Btn>
        <Btn full variant="outline" onClick={() => go("studio", "log")}>⚡ Live Events</Btn>
      </div>
    </div>
  );
}

/* ── Live Events ─────────────────────────────────────────── */
function LiveEvents({ go, log, pushLog, clearLog, toast }) {
  const [paused, setPaused] = useState(true);
  const endRef = useRef(null);
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" }); }, [log.length]);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const pool = [
        ["ORCHESTRATE", "Polling render workers for status.", { step: "poll" }],
        ["SUCCESS", "Thumbnail variant generated (1280×720).", { step: "thumb.done" }],
        ["ORCHESTRATE", "Uploading master to YouTube (unlisted).", { step: "upload.init" }],
        ["SUCCESS", "Caption file (.srt) attached.", { step: "captions.done" }],
        ["ERROR", "Rate limit hit on ElevenLabs. Backing off 30s.", { step: "voiceover", error: "429" }, true],
      ];
      const e = pool[Math.floor(Math.random() * pool.length)];
      pushLog(e[0], e[1], e[2], e[3]);
    }, 2600);
    return () => clearInterval(t);
  }, [paused, pushLog]);

  const levelColor = (l) => (l === "SUCCESS" ? C.accent : l === "ERROR" ? C.red : C.blue);
  return (
    <div>
      <TopBar title="Live Events" onBack={() => go("studio")} right={<>
        <span onClick={clearLog} style={{ cursor: "pointer" }}>Clear 🗑</span>
        <span onClick={() => setPaused((p) => !p)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>{paused ? "Resume" : "Pause"} <Toggle on={!paused} onChange={() => setPaused((p) => !p)} /></span>
      </>} />
      <Card style={{ background: "#05080f", fontFamily: MONO, padding: 12, maxHeight: 560, overflowY: "auto" }}>
        {log.map((e, i) => (
          <div key={i} style={{ padding: "10px 0", borderBottom: i < log.length - 1 ? `1px solid #131a28` : "none" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5 }}>
                <span style={{ color: C.muted }}>[{e.ts}]</span>{" "}
                <span style={{ color: levelColor(e.level), fontWeight: 700 }}>{e.level}:</span>{" "}
                <span style={{ color: e.level === "ERROR" ? "#f7a7ab" : C.text }}>{e.message}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <span onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ ts: e.ts, level: e.level, message: e.message, ...e.payload }, null, 2)); toast("Event JSON copied"); }} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.border}`, color: C.textDim, cursor: "pointer" }}>Copy JSON</span>
              {e.retryable && <span onClick={() => pushLog("ORCHESTRATE", `Retrying: ${e.message.replace(/\.$/, "")}…`, { ...e.payload, retry: true })} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: C.cardHi, color: C.text, cursor: "pointer" }}>Retry</span>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.cardAlt, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🐞</div>
      </div>
    </div>
  );
}

/* ── Script Editor & Storyboard Tune ──────────────────────── */
const TAG_RE = /\[(Emphasis|Speed|Pitch)[^\]]*\]/g;
function renderScript(text) {
  const out = [];
  let last = 0, m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const kind = m[1];
    const bg = kind === "Emphasis" ? C.purpleDim : kind === "Speed" ? C.blueDim : C.accentDim;
    const fg = kind === "Emphasis" ? C.purple : kind === "Speed" ? C.blue : C.accent;
    out.push(<span key={m.index} style={{ background: bg, color: fg, borderRadius: 5, padding: "1px 5px", fontSize: 11.5, fontWeight: 700, margin: "0 1px", display: "inline-block" }}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ScriptStoryboard({ go, scenes, setScenes, pushLog, toast, characterSync, setCharacterSync }) {
  const [script, setScript] = useState(SCRIPT0);
  const [editing, setEditing] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [emphasis, setEmphasis] = useState(60);
  const [pitch, setPitch] = useState(0);
  const words = useMemo(() => script.replace(TAG_RE, "").trim().split(/\s+/).filter(Boolean).length, [script]);
  const dur = Math.round(words / 2.4); // ~2.4 wps
  const insert = (tag) => { setScript((s) => s.trimEnd() + " " + tag); };
  const renderScene = (id) => {
    setScenes((sc) => sc.map((s) => (s.id === id ? { ...s, status: "processing" } : s)));
    const sc = scenes.find((s) => s.id === id);
    pushLog("ORCHESTRATE", `Rendering ${sc.topic} via Runway Gen-3.`, { step: "scene.render", scene: id });
    toast(`Queued: ${sc.label}`);
    setTimeout(() => {
      setScenes((s2) => s2.map((s) => (s.id === id ? { ...s, status: "done" } : s)));
      pushLog("SUCCESS", `${sc.topic} rendered.`, { step: "scene.done", scene: id });
    }, 2200);
  };
  return (
    <div>
      <TopBar title="Script Editor & Storyboard Tune" onBack={() => go("studio")} right={<span style={{ fontSize: 16 }}>📌</span>} />
      <div style={{ background: "linear-gradient(90deg,#16314d,#1b2436)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12.5, fontWeight: 600 }}>
        Live Word Count: <b style={{ color: C.accent }}>{words}</b> &nbsp;|&nbsp; Est. Duration: <b style={{ color: C.accent }}>{mmss(dur)}</b>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow right={<Btn size="sm" variant={editing ? "primary" : "card"} onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit"}</Btn>}>Script Editor</Eyebrow>
        {editing ? (
          <textarea value={script} onChange={(e) => setScript(e.target.value)} style={{ width: "100%", minHeight: 180, background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 12, fontSize: 13, lineHeight: 1.7, fontFamily: FONT, resize: "vertical", boxSizing: "border-box" }} />
        ) : (
          <div style={{ fontSize: 13.5, lineHeight: 1.9, color: C.text, whiteSpace: "pre-wrap" }}>{renderScript(script)}</div>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow>ElevenLabs Prosody Tuning</Eyebrow>
        {[
          { l: `Speed  (${speed.toFixed(1)}×)`, v: speed, min: 0.8, max: 1.5, step: 0.1, set: setSpeed, tag: speed > 1.1 ? "[Speed: Fast]" : speed < 0.95 ? "[Speed: Slow]" : null, accent: C.blue },
          { l: `Emphasis  (${emphasis})`, v: emphasis, min: 0, max: 100, step: 1, set: setEmphasis, tag: emphasis >= 70 ? "[Emphasis: Strong]" : null, accent: C.purple },
          { l: `Pitch  (${pitch > 0 ? "+" : ""}${pitch})`, v: pitch, min: -2, max: 2, step: 1, set: setPitch, tag: pitch >= 1 ? "[Pitch: High]" : pitch <= -1 ? "[Pitch: Low]" : null, accent: C.accent },
        ].map((r) => (
          <div key={r.l} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 7 }}>
              <span style={{ color: C.textDim }}>{r.l}</span>
              {r.tag && <span onClick={() => insert(r.tag)} style={{ fontSize: 10, color: r.accent, cursor: "pointer", border: `1px solid ${r.accent}`, borderRadius: 5, padding: "1px 6px" }}>+ {r.tag}</span>}
            </div>
            <Slider value={r.v} min={r.min} max={r.max} step={r.step} onChange={r.set} accent={r.accent} />
          </div>
        ))}
      </Card>

      <Card>
        <Eyebrow>Storyboard Tune & Prompt Engineer</Eyebrow>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: C.cardAlt, borderRadius: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Character Sync</div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>Locks British presenter attributes across all prompts</div>
          </div>
          <Toggle on={characterSync} onChange={setCharacterSync} />
        </div>
        {scenes.map((sc) => (
          <div key={sc.id} style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {sc.topic}
              <Pill bg={sc.status === "done" ? C.accentDim : sc.status === "error" ? C.redDim : sc.status === "processing" ? C.blueDim : C.cardHi} color={sc.status === "done" ? C.accent : sc.status === "error" ? C.red : sc.status === "processing" ? C.blue : C.muted}>{sc.status}</Pill>
            </div>
            <textarea defaultValue={sc.prompt + (characterSync ? "" : sc.prompt.includes("[Sync: Locked]") ? "" : "")} onChange={(e) => setScenes((s2) => s2.map((s) => (s.id === sc.id ? { ...s, prompt: e.target.value } : s)))} style={{ width: "100%", minHeight: 64, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, color: C.textDim, padding: 9, fontSize: 12, lineHeight: 1.5, fontFamily: FONT, resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Btn size="sm" variant="card" full onClick={() => toast("Prompt tweak applied")}>Tweak Prompt</Btn>
              <Btn size="sm" variant="blue" full onClick={() => renderScene(sc.id)}>Render Scene</Btn>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function StudioTab(props) {
  const [sub, setSub] = useState("creator"); // creator | log | script
  // allow external nav to set sub
  useEffect(() => { if (props.studioSub) { setSub(props.studioSub); props.clearStudioSub(); } }, [props.studioSub]);
  if (sub === "log") return <LiveEvents {...props} go={(t, s) => { if (t === "studio") setSub(s || "creator"); else props.go(t, s); }} />;
  if (sub === "script") return <ScriptStoryboard {...props} go={(t, s) => { if (t === "studio") setSub(s || "creator"); else props.go(t, s); }} />;
  return <VideoCreator {...props} go={(t, s) => { if (t === "studio") setSub(s || "creator"); else props.go(t, s); }} />;
}

/* ════════════════════════════════════════════════════════════════
   SCREEN: Projects → list / Bulk Actions / Batch Approval
   ════════════════════════════════════════════════════════════════ */
const STAGE_ORDER = ["Idea", "Script", "Render", "Approval", "Scheduled", "Published"];

function ProjectList({ projects, go }) {
  const byStage = STAGE_ORDER.map((st) => ({ st, items: projects.filter((p) => p.stage === st) })).filter((g) => g.items.length);
  return (
    <div>
      <TopBar title="Projects" right={<span onClick={() => go("projects", "review")} style={{ color: C.gold }}>Review feed</span>} />
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Btn full variant="blue" onClick={() => go("projects", "bulk")}>☑ Bulk Actions</Btn>
        <Btn full variant="outline" color={C.gold} onClick={() => go("projects", "review")}>⇄ Batch Approval</Btn>
      </div>
      {byStage.map((g) => (
        <div key={g.st} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>{g.st} <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>({g.items.length})</span></div>
          {g.items.map((p) => (
            <Card key={p.id} style={{ padding: 12, marginBottom: 8, borderLeft: `3px solid ${p.priority === "High" ? C.red : p.priority === "Medium" ? C.gold : C.muted}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{p.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{p.meta} · {p.priority} Priority</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Bulk Actions ─────────────────────────────────────────── */
function BulkActions({ projects, go, toast, setProjects }) {
  const [stageF, setStageF] = useState("All");
  const [prioF, setPrioF] = useState("All");
  const [sel, setSel] = useState(new Set(["p1", "p2", "p3", "p4", "p5", "p6", "p7"].filter((id) => projects.some((p) => p.id === id))));
  const filtered = projects.filter((p) => (stageF === "All" || p.stage === stageF) && (prioF === "All" || p.priority === prioF));
  const groups = STAGE_ORDER.map((st) => ({ st, items: filtered.filter((p) => p.stage === st) })).filter((g) => g.items.length);
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selCount = [...sel].filter((id) => filtered.some((p) => p.id === id)).length;
  const act = (label, mutate) => {
    if (selCount === 0) return toast("Select items first");
    setProjects((ps) => ps.map((p) => {
      if (!sel.has(p.id)) return p;
      const patch = mutate(p);
      return patch ? { ...p, ...patch } : p;
    }));
    toast(`${label}: ${selCount} item${selCount > 1 ? "s" : ""}`);
  };
  const Dropdown = ({ label, value, opts, onChange }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ background: C.cardAlt, color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 10px", fontSize: 12, fontFamily: FONT }}>
      <option value="All">{label}: All</option>
      {opts.map((o) => <option key={o} value={o}>{label}: {o}</option>)}
    </select>
  );
  return (
    <div style={{ paddingBottom: 78 }}>
      <TopBar title="Bulk Actions" onBack={() => go("projects")} right={<span onClick={() => go("projects")} style={{ color: C.blue }}>Done</span>} accentRight />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 38, height: 36, borderRadius: 9, background: C.cardAlt, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>⌗</div>
        <Dropdown label="Stage" value={stageF} opts={["Idea", "Script", "Render", "Approval"]} onChange={setStageF} />
        <Dropdown label="Priority" value={prioF} opts={["High", "Medium", "Low"]} onChange={setPrioF} />
      </div>
      {groups.map((g) => (
        <div key={g.st} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>{g.st} <span style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>({g.items.filter((p) => sel.has(p.id)).length} Selected)</span></div>
          {g.items.map((p) => {
            const on = sel.has(p.id);
            return (
              <div key={p.id} onClick={() => toggle(p.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, marginBottom: 8, borderRadius: 12, cursor: "pointer", background: on ? "rgba(250,204,21,0.06)" : C.card, border: `1px solid ${on ? C.gold : C.border}`, borderLeft: `4px solid ${on ? C.gold : p.priority === "High" ? C.red : p.priority === "Medium" ? "#7a6a2a" : C.border}` }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${on ? C.gold : C.muted}`, background: on ? C.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#3a2f08", flexShrink: 0 }}>{on ? "✓" : ""}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{p.meta} | {p.priority} Priority</div>
                </div>
                <span style={{ fontSize: 18 }}>{p.emoji}</span>
              </div>
            );
          })}
        </div>
      ))}
      {/* sticky action bar */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "linear-gradient(180deg,#0c2a52,#0a1f3d)", borderTop: `1px solid ${C.blue}`, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 4 }}>
        {[
          { i: <b style={{ fontSize: 16 }}>{selCount}</b>, l: "Items\nSelected" },
          { i: "🤖", l: "Batch Gen\nScripts", a: () => act("Batch generate scripts", (p) => (p.stage === "Idea" ? { stage: "Script", meta: "AI Scripting (Script)", emoji: "📜" } : null)) },
          { i: "☁️", l: "Batch Render\n(Multi)", a: () => act("Batch render (multi-provider)", (p) => (p.stage === "Script" ? { stage: "Render", meta: "Rendering (Render) | Multi-Provider: AWS/GCP", emoji: "🎬", providers: ["AWS", "GCP"] } : null)) },
          { i: "➡️", l: "Bulk Move\nto Approval", a: () => act("Moved to approval", (p) => (p.stage === "Render" ? { stage: "Approval", meta: "Awaiting approval (Approval)", emoji: "✅" } : null)) },
          { i: "🗑️", l: "Delete\nSelected", a: () => { if (selCount) { setProjects((ps) => ps.filter((p) => !sel.has(p.id))); toast(`Deleted ${selCount} item${selCount > 1 ? "s" : ""}`); setSel(new Set()); } } },
        ].map((b, i) => (
          <div key={i} onClick={b.a} style={{ flex: 1, textAlign: "center", cursor: b.a ? "pointer" : "default", color: "#dbe6f5" }}>
            <div style={{ fontSize: 18, lineHeight: "22px" }}>{b.i}</div>
            <div style={{ fontSize: 9, whiteSpace: "pre-line", lineHeight: 1.2, marginTop: 2 }}>{b.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Batch Approval Review Feed ───────────────────────────── */
function BatchApproval({ go, reviews, setReviews, toast }) {
  const idx = reviews.findIndex((r) => r.decision === null);
  const reviewed = reviews.filter((r) => r.decision !== null).length;
  const approved = reviews.filter((r) => r.decision === "approve").length;
  const cur = idx >= 0 ? reviews[idx] : null;
  const next = idx >= 0 && idx + 1 < reviews.length ? reviews[idx + 1] : null;
  const [comment, setComment] = useState("");
  const [anim, setAnim] = useState(null); // 'approve' | 'reject'
  const decide = (d) => {
    if (!cur) return;
    setAnim(d);
    setTimeout(() => {
      setReviews((rs) => rs.map((r) => (r.id === cur.id ? { ...r, decision: d, comment } : r)));
      setComment("");
      setAnim(null);
      toast(d === "approve" ? "Approved ✓" : "Rejected ✗");
    }, 260);
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px 12px" }}>
        <div onClick={() => go("projects")} style={{ width: 34, height: 34, borderRadius: 10, background: C.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18 }}>‹</div>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 800, lineHeight: 1.15 }}>Batch Approval<br />Review Feed</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{reviewed}/{reviews.length}</div>
          <div style={{ fontSize: 10, color: C.muted }}>Reviewed</div>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}><ProgressBar pct={(reviewed / reviews.length) * 100} h={4} /></div>

      {/* card stack */}
      <div style={{ position: "relative", height: 470, marginBottom: 16 }}>
        {next && (
          <div style={{ position: "absolute", inset: "8px 14px 0", borderRadius: 18, background: C.cardAlt, border: `1px solid ${C.border}`, transform: "scale(0.96) translateY(8px)", opacity: 0.6 }} />
        )}
        {cur ? (
          <div style={{ position: "absolute", inset: 0, borderRadius: 18, overflow: "hidden", background: "linear-gradient(180deg,#1a2436,#0f1623)", border: `1px solid ${C.border}`, transition: "transform .26s, opacity .26s", transform: anim === "approve" ? "translateX(120%) rotate(12deg)" : anim === "reject" ? "translateX(-120%) rotate(-12deg)" : "none", opacity: anim ? 0 : 1 }}>
            <div style={{ height: 280, background: "linear-gradient(135deg,#243049,#161d2e)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
              {cur.thumb}
              <Pill style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,.5)", color: "#fff", fontSize: 9, textTransform: "none" }}>{cur.source}</Pill>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "30px 16px 16px", background: "linear-gradient(180deg,transparent,rgba(0,0,0,.75))", fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>{cur.title}</div>
              {/* swipe hints */}
              <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", textAlign: "center" }}>
                <div onClick={() => decide("approve")} style={{ width: 54, height: 54, borderRadius: "50%", background: C.accentDim, border: `3px solid ${C.accent}`, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, cursor: "pointer" }}>✓</div>
              </div>
              <div style={{ position: "absolute", left: 16, top: "62%", transform: "translateY(-50%)" }}>
                <div onClick={() => decide("reject")} style={{ width: 54, height: 54, borderRadius: "50%", background: C.redDim, border: `3px solid ${C.red}`, color: C.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, cursor: "pointer" }}>✕</div>
              </div>
            </div>
            <div style={{ padding: 16, display: "flex", gap: 10 }}>
              <Btn full variant="primary" onClick={() => decide("approve")}>✓ APPROVE</Btn>
              <Btn full variant="danger" onClick={() => decide("reject")}>✕ REJECT</Btn>
            </div>
            <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment…  🎙" style={{ flex: 1, background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 999, color: C.text, padding: "10px 14px", fontSize: 13, outline: "none", fontFamily: FONT }} />
              <Btn variant="card" onClick={() => { if (comment) { toast("Feedback sent"); setComment(""); } }}>Send</Btn>
            </div>
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.muted, gap: 8 }}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Review complete</div>
            <div style={{ fontSize: 13 }}>{approved} approved · {reviews.length - approved} rejected</div>
            <Btn variant="outline" onClick={() => setReviews((rs) => rs.map((r) => ({ ...r, decision: null })))}>Reset feed</Btn>
          </div>
        )}
      </div>

      <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14 }}>
        <div style={{ fontSize: 12.5 }}><b>Batch Summary:</b> {approved} of {reviews.length} videos approved. <span style={{ color: C.blue, textDecoration: "underline" }}>Session Progress</span>.</div>
        <Btn size="sm" variant="card" onClick={() => go("projects")}>Review Later</Btn>
      </Card>
    </div>
  );
}

function ProjectsTab(props) {
  const [sub, setSub] = useState("list");
  useEffect(() => { if (props.projectsSub) { setSub(props.projectsSub); props.clearProjectsSub(); } }, [props.projectsSub]);
  const go = (t, s) => { if (t === "projects") setSub(s || "list"); else props.go(t, s); };
  if (sub === "bulk") return <BulkActions {...props} go={go} />;
  if (sub === "review") return <BatchApproval {...props} go={go} />;
  return <ProjectList {...props} go={go} />;
}

/* ════════════════════════════════════════════════════════════════
   SCREEN: Providers → Smart Fallback Rule Builder + Fallback Sandbox
   ════════════════════════════════════════════════════════════════ */
function RuleBuilder({ go, providers, setProviders, rules, setRules, costCap, setCostCap, toast }) {
  const move = (i, dir) => {
    setProviders((ps) => {
      const j = i + dir;
      if (j < 0 || j >= ps.length) return ps;
      const n = [...ps];
      [n[i], n[j]] = [n[j], n[i]];
      return n.map((p, k) => ({ ...p, role: k === 0 ? "Active (Primary)" : "Ready (Backup)" }));
    });
  };
  const [adding, setAdding] = useState(false);
  const [newIf, setNewIf] = useState("");
  const [newThen, setNewThen] = useState(providers[0]?.id);
  return (
    <div>
      <TopBar title="Smart Fallback Rule Builder" onBack={() => go("providers")} right={<span onClick={() => { toast("Fallback rules saved"); }} style={{ color: C.blue }}>Save</span>} accentRight />

      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Priority Ladder & Fallbacks</div>
      {providers.map((p, i) => (
        <Card key={p.id} style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, color: C.muted }}>
              <span onClick={() => move(i, -1)} style={{ cursor: "pointer", fontSize: 11 }}>▲</span>
              <span style={{ fontSize: 14 }}>⠿</span>
              <span onClick={() => move(i, 1)} style={{ cursor: "pointer", fontSize: 11 }}>▼</span>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#0a0f1c", fontWeight: 800, flexShrink: 0 }}>{p.glyph}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{i + 1}. {p.short} <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>({i === 0 ? "Top Priority" : i === 1 ? "Secondary" : i === 2 ? "Tertiary" : "Backup"})</span></div>
              <Pill style={{ marginTop: 4 }} bg={i === 0 ? C.accentDim : C.cardHi} color={i === 0 ? C.accent : C.muted}>● {p.role}</Pill>
              {i === 0 && <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>{p.est}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 9.5, color: C.textDim, width: 56, textAlign: "right", lineHeight: 1.1 }}>on error</span><Toggle on={p.fallbackOnError} onChange={(v) => setProviders((ps) => ps.map((x) => (x.id === p.id ? { ...x, fallbackOnError: v } : x)))} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 9.5, color: C.textDim, width: 56, textAlign: "right", lineHeight: 1.1 }}>on latency</span><Toggle on={p.fallbackOnLatency} onChange={(v) => setProviders((ps) => ps.map((x) => (x.id === p.id ? { ...x, fallbackOnLatency: v } : x)))} /></div>
            </div>
          </div>
        </Card>
      ))}

      <Card style={{ marginTop: 6, marginBottom: 14 }}>
        <Eyebrow>Cost Cap per Video Project</Eyebrow>
        <Slider value={costCap} min={0} max={500} step={10} onChange={setCostCap} accent={C.blue} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginTop: 6 }}>
          <span>£0</span><span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{gbp(costCap)}</span><span>£500</span>
        </div>
      </Card>

      <Card>
        <Eyebrow right={<Btn size="sm" variant="blue" onClick={() => setAdding((a) => !a)}>+ Add Rule</Btn>}>Smart Routing Logic</Eyebrow>
        {adding && (
          <div style={{ background: C.cardAlt, borderRadius: 10, padding: 10, marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.blue, fontWeight: 700 }}>IF</span>
            <input value={newIf} onChange={(e) => setNewIf(e.target.value)} placeholder="e.g. scene type is B-roll" style={{ flex: 1, minWidth: 120, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "6px 9px", fontSize: 12, fontFamily: FONT }} />
            <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>THEN use</span>
            <select value={newThen} onChange={(e) => setNewThen(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "6px 9px", fontSize: 12, fontFamily: FONT }}>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
            </select>
            <Btn size="sm" onClick={() => { if (newIf.trim()) { setRules((r) => [...r, { id: uid(), ifText: newIf.trim(), thenProviderId: newThen }]); setNewIf(""); setAdding(false); toast("Rule added"); } }}>Add</Btn>
          </div>
        )}
        {rules.map((r) => {
          const prov = providers.find((p) => p.id === r.thenProviderId);
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, background: C.cardAlt, borderRadius: 10, padding: "9px 11px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.blue, fontWeight: 700 }}>IF</div>
                <div style={{ fontSize: 12.5, marginTop: 1 }}>{r.ifText}</div>
              </div>
              <div style={{ color: C.muted, fontSize: 16 }}>→</div>
              <div style={{ flex: 1, background: C.cardAlt, borderRadius: 10, padding: "9px 11px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.accent, fontWeight: 700 }}>THEN</div>
                <div style={{ fontSize: 12.5, marginTop: 1 }}>use {prov?.short || "—"}</div>
              </div>
              <span onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))} style={{ color: C.muted, cursor: "pointer", fontSize: 16 }}>×</span>
            </div>
          );
        })}
        {!rules.length && <div style={{ fontSize: 12, color: C.muted }}>No routing rules — uses the priority ladder above.</div>}
      </Card>
    </div>
  );
}

function FallbackSandbox({ go, providers }) {
  const [scenKey, setScenKey] = useState("runwayCredits");
  const scen = SCENARIOS[scenKey];
  const ladder = providers; // order = priority
  const [phase, setPhase] = useState(2); // 0 idle,1 running,2 done
  const fbProvider = ladder[Math.min(scen.catchAt + 1, ladder.length - 1)];
  const run = () => {
    setPhase(0);
    setTimeout(() => setPhase(1), 80);
    setTimeout(() => setPhase(2), 1500);
  };
  const Node = ({ title, sub, color, glow, active }) => (
    <div style={{ borderRadius: 12, padding: "12px 14px", background: C.card, border: `2px solid ${color}`, boxShadow: glow ? `0 0 20px ${color}55` : "none", textAlign: "left", opacity: active ? 1 : 0.5, transition: "opacity .3s, box-shadow .3s" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: color === C.red ? C.red : C.textDim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
  const Arrow = ({ on }) => <div style={{ textAlign: "center", color: on ? C.accent : C.muted, fontSize: 18, lineHeight: "20px", transition: "color .3s" }}>⌄<br /><span style={{ fontSize: 12 }}>⌄</span></div>;
  return (
    <div>
      <TopBar title="Fallback Sandbox" onBack={() => go("providers")} />
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>Simulate Scenario</div>
      <select value={scenKey} onChange={(e) => { setScenKey(e.target.value); run(); }} style={{ width: "100%", background: C.cardAlt, border: `1px solid ${C.blue}`, borderRadius: 10, color: C.text, padding: "11px 12px", fontSize: 14, fontFamily: FONT, marginBottom: 18 }}>
        {Object.entries(SCENARIOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
        <Node title="Request" color={C.blue} active />
        <Arrow on={phase >= 1} />
        <Node title="Primary Provider" sub={`${ladder[0].name} — ${phase >= 1 ? scen.primaryError : "running…"}`} color={phase >= 1 ? C.red : C.blue} glow={phase >= 1} active />
        <div style={{ textAlign: "center", padding: "6px 0" }}>{phase >= 1 ? <Pill bg={C.accentDim} color={C.accent}>⟲ Fallback Triggered</Pill> : <Pill bg={C.cardHi} color={C.muted}>monitoring…</Pill>}</div>
        <Node title={`Fallback ${scen.catchAt + 1}`} sub={`Secondary Provider: ${fbProvider.name} — Status: ${phase >= 2 ? "Active" : "spinning up…"}`} color={C.accent} glow={phase >= 1} active={phase >= 1} />
        <Arrow on={phase >= 2} />
        <Node title="Final Output" sub={`Status: ${phase >= 2 ? "Rendering" : "queued"}`} color={C.blue} active={phase >= 2} />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <Eyebrow>Results</Eyebrow>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { i: "£", l: "Hypothetical Cost", v: gbp(scen.cost) },
            { i: "⏱", l: "Time to Render", v: scen.time },
            { i: "◆", l: "Quality Impact", v: scen.quality },
          ].map((r) => (
            <div key={r.l} style={{ flex: 1, background: C.cardAlt, borderRadius: 10, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 14 }}>{r.i}</div>
              <div style={{ fontSize: 9.5, color: C.muted, marginTop: 4, lineHeight: 1.2 }}>{r.l}</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>{r.v}</div>
            </div>
          ))}
        </div>
      </Card>
      <Btn full variant="card" onClick={run}>▶ Simulate Again</Btn>
    </div>
  );
}

function ProvidersTab(props) {
  const [sub, setSub] = useState("rules");
  useEffect(() => { if (props.providersSub) { setSub(props.providersSub); props.clearProvidersSub(); } }, [props.providersSub]);
  const go = (t, s) => { if (t === "providers") setSub(s || "rules"); else props.go(t, s); };
  if (sub === "sandbox") return <FallbackSandbox {...props} go={go} />;
  return (
    <div>
      <div style={{ display: "flex", background: C.cardAlt, borderRadius: 12, padding: 4, marginBottom: 4 }}>
        {[["rules", "Rule Builder"], ["sandbox", "Sandbox"]].map(([k, l]) => (
          <div key={k} onClick={() => setSub(k)} style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", background: sub === k ? C.purple : "transparent", color: sub === k ? "#1a0f2e" : C.textDim }}>{l}</div>
        ))}
      </div>
      <RuleBuilder {...props} go={go} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   APP SHELL
   ════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "studio", label: "Studio", icon: "▶" },
  { id: "projects", label: "Projects", icon: "▤" },
  { id: "analytics", label: "Analytics", icon: "▥" },
  { id: "providers", label: "Providers", icon: "✦" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [studioSub, setStudioSub] = useState(null);
  const [projectsSub, setProjectsSub] = useState(null);
  const [providersSub, setProvidersSub] = useState(null);

  const [providers, setProviders] = useState(PROVIDERS0); // index 0 = primary; rest = fallbacks
  const [projects, setProjects] = useState(PROJECTS0);
  // seed: 3 already reviewed (all approved) — first undecided card = "Understanding Capital Gains Tax..."
  const [reviews, setReviews] = useState(REVIEWS0.map((r, i) => (i >= 1 && i <= 3 ? { ...r, decision: "approve" } : r)));
  const [scenes, setScenes] = useState(SCENES0);
  const [log, setLog] = useState(LOG0);
  const [rules, setRules] = useState(RULES0);
  const [costCap, setCostCap] = useState(250);
  const [characterSync, setCharacterSync] = useState(true);
  const [queue, setQueue] = useState(QUEUE0);
  const [toastMsg, setToastMsg] = useState("");
  const toastRef = useRef();
  const toast = (m) => { setToastMsg(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToastMsg(""), 1900); };
  const pushLog = (level, message, payload = {}, retryable = false) => setLog((l) => [...l, { ts: ts(), level, message, payload, retryable }]);
  const clearLog = () => setLog([]);

  // tick the publishing queue countdowns
  useEffect(() => {
    const t = setInterval(() => setQueue((q) => q.map((x) => ({ ...x, secondsLeft: Math.max(0, x.secondsLeft - 1) }))), 1000);
    return () => clearInterval(t);
  }, []);

  const go = (t, sub = null) => {
    setTab(t);
    if (t === "studio") setStudioSub(sub || null);
    if (t === "projects") setProjectsSub(sub || null);
    if (t === "providers") setProvidersSub(sub || null);
  };

  const shared = { go, toast };
  let body = null;
  if (tab === "dashboard") body = <Dashboard {...shared} queue={queue} projects={projects} />;
  else if (tab === "studio") body = <StudioTab {...shared} scenes={scenes} setScenes={setScenes} log={log} pushLog={pushLog} clearLog={clearLog} characterSync={characterSync} setCharacterSync={setCharacterSync} studioSub={studioSub} clearStudioSub={() => setStudioSub(null)} />;
  else if (tab === "projects") body = <ProjectsTab {...shared} projects={projects} setProjects={setProjects} reviews={reviews} setReviews={setReviews} projectsSub={projectsSub} clearProjectsSub={() => setProjectsSub(null)} />;
  else if (tab === "analytics") body = <AnalyticsTab {...shared} queue={queue} providers={providers} />;
  else if (tab === "providers") body = <ProvidersTab {...shared} providers={providers} setProviders={setProviders} rules={rules} setRules={setRules} costCap={costCap} setCostCap={setCostCap} providersSub={providersSub} clearProvidersSub={() => setProvidersSub(null)} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FONT, color: C.text, boxSizing: "border-box" }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        select { appearance:none; -webkit-appearance:none; }
      `}</style>

      {/* phone frame */}
      <div style={{ width: 392, maxWidth: "100%", height: "min(844px, 94vh)", background: C.surface, borderRadius: 44, border: "10px solid #11151f", boxShadow: "0 30px 80px rgba(0,0,0,.6)", overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
        {/* status bar */}
        <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", fontSize: 12.5, fontWeight: 700, flexShrink: 0, position: "relative" }}>
          <span>9:41</span>
          <div style={{ position: "absolute", left: "50%", top: 8, transform: "translateX(-50%)", width: 100, height: 26, background: "#000", borderRadius: 14 }} />
          <span style={{ display: "flex", gap: 5 }}><span>●●●</span><span>📶</span><span>🔋</span></span>
        </div>

        {/* scroll body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px", position: "relative" }}>
          {body}
        </div>

        <Toast msg={toastMsg} />

        {/* bottom tab bar */}
        <div style={{ height: 64, background: "rgba(11,17,30,0.96)", borderTop: `1px solid ${C.border}`, display: "flex", flexShrink: 0, paddingBottom: 6 }}>
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <div key={t.id} onClick={() => go(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", color: on ? C.accent : C.muted }}>
                <span style={{ fontSize: 17 }}>{t.icon}</span>
                <span style={{ fontSize: 9.5, fontWeight: on ? 700 : 500 }}>{t.label}</span>
              </div>
            );
          })}
        </div>

        {/* home indicator */}
        <div style={{ position: "absolute", left: "50%", bottom: 7, transform: "translateX(-50%)", width: 130, height: 5, borderRadius: 999, background: "rgba(255,255,255,.5)" }} />
      </div>
    </div>
  );
}
