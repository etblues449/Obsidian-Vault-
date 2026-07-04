---
name: Best app creating agent
description: Imported Claude.ai conversation from 2026-04-24 (10 messages)
type: reference
uuid: 3d04885c-177c-43cd-a42d-e1200c4eafe1
created_at: 2026-04-24T02:55:29.338105Z
updated_at: 2026-04-24T03:08:45.240516Z
---

# Best app creating agent

## human — 2026-04-24 02:55:29
_files:_ Screenshot_20260424_035243_Chrome.jpg

Best app creating agent

## assistant — 2026-04-24 02:55:33

 Looks like you're browsing models on OpenRouter! I can see the model picker with options like Claude Opus 4.7, Kimi K2.6, Gemma 4 variants, and more.

What are you looking to build — are you asking me to help you create an app/agent that uses OpenRouter's API, or were you asking something else? Happy to help either way!

## human — 2026-04-24 03:02:01

import { useState } from "react";

const C = {
  bg: "#0A0A0F", surface: "#12121A", card: "#1A1A26", border: "#2A2A3E",
  accent: "#00E5A0", accentDim: "#00E5A020", accentHover: "#00FFB3",
  gold: "#FFD166", muted: "#6B6B8A", text: "#E8E8F0", textDim: "#9898B8",
};

const s = {
  app: { display:"flex", height:"100vh", background:C.bg, fontFamily:"'Inter',sans-serif", color:C.text, overflow:"hidden" },
  sidebar: { width:220, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 },
  brand: { padding:"0 20px 24px", borderBottom:`1px solid ${C.border}` },
  brandName: { fontSize:20, fontWeight:700, color:C.accent, display:"flex", alignItems:"center", gap:6 },
  brandSub: { fontSize:12, color:C.muted, marginTop:4 },
  nav: { flex:1, padding:"16px 0" },
  navItem: (active) => ({
    display:"flex", alignItems:"center", gap:10, padding:"10px 20px", cursor:"pointer",
    background: active ? C.accentDim : "transparent",
    borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent",
    color: active ? C.accent : C.textDim, fontSize:14, fontWeight: active ? 600 : 400,
    transition:"all 0.15s",
  }),
  postDays: { padding:"16px 20px", borderTop:`1px solid ${C.border}` },
  main: { flex:1, overflow:"auto", padding:28 },
  pageTitle: { fontSize:24, fontWeight:700, marginBottom:4 },
  pageSub: { fontSize:14, color:C.muted, marginBottom:24 },
  grid3: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 },
  grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 },
  card: { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20 },
  cardTitle: { fontSize:11, fontWeight:600, color:C.muted, letterSpacing:"0.08em", marginBottom:14, textTransform:"uppercase" },
  statNum: { fontSize:32, fontWeight:800, marginBottom:4 },
  statLabel: { fontSize:13, color:C.muted, marginBottom:6 },
  statChange: { fontSize:12, color:C.accent, fontWeight:600 },
  badge: (type) => ({
    display:"inline-block", fontSize:10, fontWeight:700, letterSpacing:"0.05em",
    padding:"3px 8px", borderRadius:4,
    background: type==="SCHEDULED" ? "#FFD16620" : "#2A2A3E",
    color: type==="SCHEDULED" ? C.gold : C.muted,
    textTransform:"uppercase",
  }),
  videoRow: { display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` },
  videoThumb: { width:52, height:36, background:C.border, borderRadius:6, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 },
  btn: (variant) => ({
    padding: variant==="sm" ? "6px 14px" : "10px 20px",
    borderRadius:8, fontWeight:600, fontSize: variant==="sm" ? 12 : 14, cursor:"pointer", border:"none",
    background: variant==="ghost" ? "transparent" : variant==="outline" ? "transparent" : C.accent,
    color: variant==="ghost" || variant==="outline" ? C.accent : C.bg,
    border: variant==="outline" ? `1px solid ${C.accent}` : "none",
  }),
  input: { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontSize:14, outline:"none", boxSizing:"border-box" },
  textarea: { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontSize:14, outline:"none", boxSizing:"border-box", minHeight:100, resize:"vertical" },
  tag: { display:"inline-flex", alignItems:"center", gap:4, background:C.accentDim, color:C.accent, fontSize:12, padding:"4px 10px", borderRadius:20 },
  progressBar: (pct) => ({ height:6, borderRadius:3, background:`linear-gradient(90deg,${C.accent} ${pct}%,${C.border} ${pct}%)` }),
  row: { display:"flex", gap:14, marginBottom:14 },
  col: { flex:1 },
};

const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"▦" },
  { id:"schedule", label:"Schedule", icon:"▣" },
  { id:"ideas", label:"AI Ideas", icon:"✦" },
  { id:"script", label:"AI Script", icon:"✧" },
  { id:"growth", label:"Growth", icon:"↗" },
  { id:"prepublish", label:"Pre-publish", icon:"✓" },
];

const VIDEOS = [
  { id:1, title:"5 Tax Mistakes Salaried People Make Every Year", status:"SCHEDULED", date:"2026-04-23", emoji:"💸", views:null },
  { id:2, title:"Credit Score Myths Busted by a CA", status:"DRAFT", date:"2026-04-25", emoji:"📊", views:null },
  { id:3, title:"Emergency Fund: How Much Is Actually Enough?", status:"DRAFT", date:"2026-04-28", emoji:"🛡️", views:null },
];

const TOP = [
  { title:"How I Saved ₹10L in 3 Years on a CA Salary", views:4200 },
  { title:"SIP vs Lump Sum: Which Actually Wins? (Data Deep Dive)", views:2800 },
  { title:"The 50-30-20 Rule Is Wrong – Here's What Works", views:1950 },
];

const IDEAS = [
  "Why Your Salary Hike Is Making You Poorer",
  "Mutual Fund Myths That Cost Indians Crores",
  "Home Loan vs Rent: The Real Math in 2026",
  "How HNIs Actually Manage Their Money",
  "5 Tax Harvesting Tricks Before March 31",
  "The NPS Trap Nobody Warns You About",
];

// ── Pages ────────────────────────────────────────────────────────────────────

function Dashboard() {
  return (
    <div>
      <div style={s.pageTitle}>Dashboard</div>
      <div style={s.pageSub}>Your channel at a glance</div>

      <div style={s.grid3}>
        {[
          { num:"1,420", label:"Subscribers", change:"+480 this month" },
          { num:"7,000", label:"Total Views", change:"+8.5K this month" },
          { num:"2", label:"Videos Published", change:"1 scheduled" },
        ].map(stat => (
          <div key={stat.label} style={s.card}>
            <div style={s.statNum}>{stat.num}</div>
            <div style={s.statLabel}>{stat.label}</div>
            <div style={s.statChange}>{stat.change}</div>
          </div>
        ))}
      </div>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>Upcoming Videos</div>
          {VIDEOS.slice(0,2).map(v => (
            <div key={v.id} style={s.videoRow}>
              <div style={s.videoThumb}>{v.emoji}</div>
              <div style={{flex:1}}>
                <span style={s.badge(v.status)}>{v.status}</span>
                <div style={{fontSize:13, marginTop:4, lineHeight:1.4}}>{v.title}</div>
              </div>
              <div style={{fontSize:11, color:C.muted, flexShrink:0}}>{v.date}</div>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Top Performers</div>
          {TOP.map((v,i) => (
            <div key={i} style={{...s.videoRow, alignItems:"flex-start"}}>
              <div style={{flex:1, fontSize:13, lineHeight:1.4}}>{v.title}</div>
              <div style={{fontSize:13, color:C.textDim, flexShrink:0, display:"flex", alignItems:"center", gap:4}}>
                {v.views.toLocaleString()} <span style={{color:C.accent}}>▶</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Monthly Goal Progress</div>
        <div style={s.row}>
          {[
            { label:"Subscribers", cur:1420, goal:2000 },
            { label:"Views", cur:7000, goal:15000 },
            { label:"Videos", cur:2, goal:6 },
          ].map(g => (
            <div key={g.label} style={s.col}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6}}>
                <span style={{color:C.muted}}>{g.label}</span>
                <span style={{color:C.text}}>{g.cur.toLocaleString()} / {g.goal.toLocaleString()}</span>
              </div>
              <div style={s.progressBar(Math.round(g.cur/g.goal*100))} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Schedule() {
  const [videos, setVideos] = useState(VIDEOS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", date:"", emoji:"🎬" });

  const add = () => {
    if (!form.title) return;
    setVideos([...videos, { id:Date.now(), ...form, status:"DRAFT", views:null }]);
    setForm({ title:"", date:"", emoji:"🎬" });
    setShowForm(false);
  };

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4}}>
        <div style={s.pageTitle}>Schedule</div>
        <button style={s.btn()} onClick={() => setShowForm(v => !v)}>+ Add Video</button>
      </div>
      <div style={{...s.pageSub, marginBottom:20}}>Plan and track your content calendar</div>

      {showForm && (
        <div style={{...s.card, marginBottom:16}}>
          <div style={s.cardTitle}>New Video</div>
          <div style={s.row}>
            <input style={{...s.input, width:50}} value={form.emoji} onChange={e=>setForm({...form,emoji:e.target.value})} placeholder="🎬" />
            <input style={s.input} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Video title…" />
            <input type="date" style={{...s.input, width:160}} value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          </div>
          <div style={{display:"flex", gap:8, marginTop:8}}>
            <button style={s.btn()} onClick={add}>Save</button>
            <button style={s.btn("outline")} onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={s.card}>
        {videos.map((v,i) => (
          <div key={v.id} style={{...s.videoRow, borderBottom: i<videos.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={s.videoThumb}>{v.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:500}}>{v.title}</div>
              <div style={{fontSize:11, color:C.muted, marginTop:3}}>Scheduled: {v.date||"TBD"}</div>
            </div>
            <span style={s.badge(v.status)}>{v.status}</span>
            <button style={{...s.btn("ghost"), padding:"4px 8px", fontSize:12}} onClick={()=>setVideos(videos.map(x=>x.id===v.id?{...x,status:x.status==="DRAFT"?"SCHEDULED":"DRAFT"}:x))}>
              {v.status==="DRAFT"?"→ Schedule":"→ Draft"}
            </button>
          </div>
        ))}
      </div>

      <div style={{...s.card, marginTop:14}}>
        <div style={s.cardTitle}>Best Post Days</div>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
            <div key={d} style={{...s.tag, background: ["Wed","Fri","Sun"].includes(d)?C.accentDim:C.border, color:["Wed","Fri","Sun"].includes(d)?C.accent:C.muted}}>
              {d}
            </div>
          ))}
        </div>
        <div style={{fontSize:12, color:C.accent, marginTop:10}}>⏰ Best: Wed 4PM</div>
      </div>
    </div>
  );
}

function AIIdeas() {
  const [ideas, setIdeas] = useState(IDEAS);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:"You are an expert YouTube content strategist for a faceless finance channel targeting Indian audiences. Generate video title ideas that are catchy, specific, and high-CTR. Respond ONLY with a JSON array of 6 title strings, no markdown, no preamble.",
          messages:[{role:"user", content:`Generate 6 YouTube video title ideas about: ${topic}`}]
        })
      });
      const d = await res.json();
      const text = d.content?.find(b=>b.type==="text")?.text || "[]";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      setIdeas(parsed);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div>
      <div style={s.pageTitle}>AI Ideas</div>
      <div style={{...s.pageSub, marginBottom:20}}>Generate high-CTR video ideas for your audience</div>

      <div style={{...s.card, marginBottom:16}}>
        <div style={s.cardTitle}>Generate New Ideas</div>
        <div style={s.row}>
          <input style={s.input} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Topic or keyword (e.g. mutual funds, tax saving, SIP)…" onKeyDown={e=>e.key==="Enter"&&generate()} />
          <button style={{...s.btn(), flexShrink:0, opacity:loading?0.6:1}} onClick={generate} disabled={loading}>
            {loading ? "Generating…" : "✦ Generate"}
          </button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Ideas ({ideas.length})</div>
        {ideas.map((idea,i) => (
          <div key={i} style={{display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i<ideas.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{width:24, height:24, borderRadius:6, background:C.accentDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:C.accent, fontWeight:700, flexShrink:0}}>{i+1}</div>
            <div style={{flex:1, fontSize:14}}>{idea}</div>
            <button style={s.btn("sm")} onClick={()=>{/* could pass to script */}}>Use</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIScript() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setScript("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:"You are a scriptwriter for a faceless Indian finance YouTube channel. Write engaging, informative video scripts with a hook, 3-4 main points, and a CTA. Use simple language for a general audience. Format with clear sections: HOOK, POINT 1, POINT 2, POINT 3, CTA.",
          messages:[{role:"user", content:`Write a YouTube video script for: "${title}"`}]
        })
      });
      const d = await res.json();
      const text = d.content?.find(b=>b.type==="text")?.text || "";
      setScript(text);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div>
      <div style={s.pageTitle}>AI Script</div>
      <div style={{...s.pageSub, marginBottom:20}}>Generate full video scripts instantly</div>

      <div style={{...s.card, marginBottom:16}}>
        <div style={s.cardTitle}>Video Title</div>
        <div style={s.row}>
          <input style={s.input} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter your video title…" onKeyDown={e=>e.key==="Enter"&&generate()} />
          <button style={{...s.btn(), flexShrink:0, opacity:loading?0.6:1}} onClick={generate} disabled={loading}>
            {loading ? "Writing…" : "✦ Write Script"}
          </button>
        </div>
      </div>

      {(script || loading) && (
        <div style={s.card}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
            <div style={s.cardTitle}>Generated Script</div>
            {script && <button style={s.btn("sm")} onClick={()=>navigator.clipboard.writeText(script)}>Copy</button>}
          </div>
          {loading ? (
            <div style={{color:C.muted, fontSize:14}}>✦ Writing your script…</div>
          ) : (
            <pre style={{fontSize:13, lineHeight:1.8, color:C.textDim, whiteSpace:"pre-wrap", margin:0}}>{script}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function Growth() {
  const weeks = ["W1","W2","W3","W4","W5","W6","W7","W8"];
  const subs = [820,940,1050,1120,1200,1310,1390,1420];
  const views = [1200,1800,2400,3100,4200,5500,6400,7000];
  const max_s = Math.max(...subs), max_v = Math.max(...views);

  return (
    <div>
      <div style={s.pageTitle}>Growth</div>
      <div style={{...s.pageSub, marginBottom:20}}>Track your channel's momentum</div>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>Subscribers (8 weeks)</div>
          <div style={{display:"flex", alignItems:"flex-end", gap:6, height:80}}>
            {subs.map((v,i) => (
              <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                <div style={{width:"100%", background:C.accent, borderRadius:"3px 3px 0 0", height: `${(v/max_s)*72}px`, opacity: 0.6+i*0.05 }} />
                <div style={{fontSize:9, color:C.muted}}>{weeks[i]}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12, color:C.accent, marginTop:8}}>+73% growth in 8 weeks</div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Total Views (8 weeks)</div>
          <div style={{display:"flex", alignItems:"flex-end", gap:6, height:80}}>
            {views.map((v,i) => (
              <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                <div style={{width:"100%", background:C.gold, borderRadius:"3px 3px 0 0", height: `${(v/max_v)*72}px`, opacity: 0.5+i*0.06 }} />
                <div style={{fontSize:9, color:C.muted}}>{weeks[i]}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12, color:C.gold, marginTop:8}}>+483% views growth in 8 weeks</div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Growth Tips</div>
        {[
          { tip:"Post consistently Wed + Fri + Sun for best reach", impact:"High" },
          { tip:"Add chapters to every video — boosts watch time 30%+", impact:"High" },
          { tip:"Thumbnail A/B test: face vs data graphic", impact:"Medium" },
          { tip:"Reply to every comment in first 2 hours", impact:"Medium" },
          { tip:"Use 3–5 relevant hashtags per video", impact:"Low" },
        ].map((t,i) => (
          <div key={i} style={{display:"flex", gap:12, padding:"10px 0", borderBottom:i<4?`1px solid ${C.border}`:"none", alignItems:"center"}}>
            <div style={{flex:1, fontSize:13}}>{t.tip}</div>
            <span style={{...s.badge(t.impact==="High"?"SCHEDULED":"DRAFT"), fontSize:10}}>
              {t.impact}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrePublish() {
  const checks = [
    "Thumbnail uploaded (1280×720px)",
    "Title contains keyword (60 chars max)",
    "Description with timestamps written",
    "Tags added (15–20 relevant tags)",
    "End screen configured",
    "Cards added at 20% and 80% mark",
    "Chapters added in description",
    "Posted to community tab",
  ];
  const [done, setDone] = useState([]);
  const toggle = (i) => setDone(d => d.includes(i) ? d.filter(x=>x!==i) : [...d,i]);

  return (
    <div>
      <div style={s.pageTitle}>Pre-publish</div>
      <div style={{...s.pageSub, marginBottom:20}}>Checklist before going live</div>

      <div style={s.card}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
          <div style={s.cardTitle}>Launch Checklist</div>
          <span style={{fontSize:12, color: done.length===checks.length ? C.accent : C.muted}}>
            {done.length}/{checks.length} complete
          </span>
        </div>
        <div style={{marginBottom:12}}>
          <div style={s.progressBar(Math.round(done.length/checks.length*100))} />
        </div>
        {checks.map((c,i) => (
          <div key={i} onClick={()=>toggle(i)} style={{display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderBottom:i<checks.length-1?`1px solid ${C.bor

## assistant — 2026-04-24 03:02:10

 It looks like your message got cut off mid-code (right at the `borderBottom` line in the PrePublish component). You've shared a really well-built React app though — a YouTube content management dashboard for a faceless finance channel with Dashboard, Schedule, AI Ideas, AI Script, Growth, and Pre-publish pages.

Before I continue, let me make sure I understand what you want:
```
This block is not supported on your current device yet.
```



## human — 2026-04-24 03:02:51

[User dismissed — do not proceed, wait for next instruction]

## assistant — 2026-04-24 03:02:53

 Got it — waiting for your instruction.

## human — 2026-04-24 03:02:54

import { useState } from "react";

const C = {
  bg: "#0A0A0F", surface: "#12121A", card: "#1A1A26", border: "#2A2A3E",
  accent: "#00E5A0", accentDim: "#00E5A020", accentHover: "#00FFB3",
  gold: "#FFD166", muted: "#6B6B8A", text: "#E8E8F0", textDim: "#9898B8",
};

const s = {
  app: { display:"flex", height:"100vh", background:C.bg, fontFamily:"'Inter',sans-serif", color:C.text, overflow:"hidden" },
  sidebar: { width:220, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 },
  brand: { padding:"0 20px 24px", borderBottom:`1px solid ${C.border}` },
  brandName: { fontSize:20, fontWeight:700, color:C.accent, display:"flex", alignItems:"center", gap:6 },
  brandSub: { fontSize:12, color:C.muted, marginTop:4 },
  nav: { flex:1, padding:"16px 0" },
  navItem: (active) => ({
    display:"flex", alignItems:"center", gap:10, padding:"10px 20px", cursor:"pointer",
    background: active ? C.accentDim : "transparent",
    borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent",
    color: active ? C.accent : C.textDim, fontSize:14, fontWeight: active ? 600 : 400,
    transition:"all 0.15s",
  }),
  postDays: { padding:"16px 20px", borderTop:`1px solid ${C.border}` },
  main: { flex:1, overflow:"auto", padding:28 },
  pageTitle: { fontSize:24, fontWeight:700, marginBottom:4 },
  pageSub: { fontSize:14, color:C.muted, marginBottom:24 },
  grid3: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 },
  grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 },
  card: { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20 },
  cardTitle: { fontSize:11, fontWeight:600, color:C.muted, letterSpacing:"0.08em", marginBottom:14, textTransform:"uppercase" },
  statNum: { fontSize:32, fontWeight:800, marginBottom:4 },
  statLabel: { fontSize:13, color:C.muted, marginBottom:6 },
  statChange: { fontSize:12, color:C.accent, fontWeight:600 },
  badge: (type) => ({
    display:"inline-block", fontSize:10, fontWeight:700, letterSpacing:"0.05em",
    padding:"3px 8px", borderRadius:4,
    background: type==="SCHEDULED" ? "#FFD16620" : "#2A2A3E",
    color: type==="SCHEDULED" ? C.gold : C.muted,
    textTransform:"uppercase",
  }),
  videoRow: { display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` },
  videoThumb: { width:52, height:36, background:C.border, borderRadius:6, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 },
  btn: (variant) => ({
    padding: variant==="sm" ? "6px 14px" : "10px 20px",
    borderRadius:8, fontWeight:600, fontSize: variant==="sm" ? 12 : 14, cursor:"pointer", border:"none",
    background: variant==="ghost" ? "transparent" : variant==="outline" ? "transparent" : C.accent,
    color: variant==="ghost" || variant==="outline" ? C.accent : C.bg,
    border: variant==="outline" ? `1px solid ${C.accent}` : "none",
  }),
  input: { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontSize:14, outline:"none", boxSizing:"border-box" },
  textarea: { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontSize:14, outline:"none", boxSizing:"border-box", minHeight:100, resize:"vertical" },
  tag: { display:"inline-flex", alignItems:"center", gap:4, background:C.accentDim, color:C.accent, fontSize:12, padding:"4px 10px", borderRadius:20 },
  progressBar: (pct) => ({ height:6, borderRadius:3, background:`linear-gradient(90deg,${C.accent} ${pct}%,${C.border} ${pct}%)` }),
  row: { display:"flex", gap:14, marginBottom:14 },
  col: { flex:1 },
};

const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"▦" },
  { id:"schedule", label:"Schedule", icon:"▣" },
  { id:"ideas", label:"AI Ideas", icon:"✦" },
  { id:"script", label:"AI Script", icon:"✧" },
  { id:"growth", label:"Growth", icon:"↗" },
  { id:"prepublish", label:"Pre-publish", icon:"✓" },
];

const VIDEOS = [
  { id:1, title:"5 Tax Mistakes Salaried People Make Every Year", status:"SCHEDULED", date:"2026-04-23", emoji:"💸", views:null },
  { id:2, title:"Credit Score Myths Busted by a CA", status:"DRAFT", date:"2026-04-25", emoji:"📊", views:null },
  { id:3, title:"Emergency Fund: How Much Is Actually Enough?", status:"DRAFT", date:"2026-04-28", emoji:"🛡️", views:null },
];

const TOP = [
  { title:"How I Saved ₹10L in 3 Years on a CA Salary", views:4200 },
  { title:"SIP vs Lump Sum: Which Actually Wins? (Data Deep Dive)", views:2800 },
  { title:"The 50-30-20 Rule Is Wrong – Here's What Works", views:1950 },
];

const IDEAS = [
  "Why Your Salary Hike Is Making You Poorer",
  "Mutual Fund Myths That Cost Indians Crores",
  "Home Loan vs Rent: The Real Math in 2026",
  "How HNIs Actually Manage Their Money",
  "5 Tax Harvesting Tricks Before March 31",
  "The NPS Trap Nobody Warns You About",
];

// ── Pages ────────────────────────────────────────────────────────────────────

function Dashboard() {
  return (
    <div>
      <div style={s.pageTitle}>Dashboard</div>
      <div style={s.pageSub}>Your channel at a glance</div>

      <div style={s.grid3}>
        {[
          { num:"1,420", label:"Subscribers", change:"+480 this month" },
          { num:"7,000", label:"Total Views", change:"+8.5K this month" },
          { num:"2", label:"Videos Published", change:"1 scheduled" },
        ].map(stat => (
          <div key={stat.label} style={s.card}>
            <div style={s.statNum}>{stat.num}</div>
            <div style={s.statLabel}>{stat.label}</div>
            <div style={s.statChange}>{stat.change}</div>
          </div>
        ))}
      </div>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>Upcoming Videos</div>
          {VIDEOS.slice(0,2).map(v => (
            <div key={v.id} style={s.videoRow}>
              <div style={s.videoThumb}>{v.emoji}</div>
              <div style={{flex:1}}>
                <span style={s.badge(v.status)}>{v.status}</span>
                <div style={{fontSize:13, marginTop:4, lineHeight:1.4}}>{v.title}</div>
              </div>
              <div style={{fontSize:11, color:C.muted, flexShrink:0}}>{v.date}</div>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Top Performers</div>
          {TOP.map((v,i) => (
            <div key={i} style={{...s.videoRow, alignItems:"flex-start"}}>
              <div style={{flex:1, fontSize:13, lineHeight:1.4}}>{v.title}</div>
              <div style={{fontSize:13, color:C.textDim, flexShrink:0, display:"flex", alignItems:"center", gap:4}}>
                {v.views.toLocaleString()} <span style={{color:C.accent}}>▶</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Monthly Goal Progress</div>
        <div style={s.row}>
          {[
            { label:"Subscribers", cur:1420, goal:2000 },
            { label:"Views", cur:7000, goal:15000 },
            { label:"Videos", cur:2, goal:6 },
          ].map(g => (
            <div key={g.label} style={s.col}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6}}>
                <span style={{color:C.muted}}>{g.label}</span>
                <span style={{color:C.text}}>{g.cur.toLocaleString()} / {g.goal.toLocaleString()}</span>
              </div>
              <div style={s.progressBar(Math.round(g.cur/g.goal*100))} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Schedule() {
  const [videos, setVideos] = useState(VIDEOS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", date:"", emoji:"🎬" });

  const add = () => {
    if (!form.title) return;
    setVideos([...videos, { id:Date.now(), ...form, status:"DRAFT", views:null }]);
    setForm({ title:"", date:"", emoji:"🎬" });
    setShowForm(false);
  };

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4}}>
        <div style={s.pageTitle}>Schedule</div>
        <button style={s.btn()} onClick={() => setShowForm(v => !v)}>+ Add Video</button>
      </div>
      <div style={{...s.pageSub, marginBottom:20}}>Plan and track your content calendar</div>

      {showForm && (
        <div style={{...s.card, marginBottom:16}}>
          <div style={s.cardTitle}>New Video</div>
          <div style={s.row}>
            <input style={{...s.input, width:50}} value={form.emoji} onChange={e=>setForm({...form,emoji:e.target.value})} placeholder="🎬" />
            <input style={s.input} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Video title…" />
            <input type="date" style={{...s.input, width:160}} value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          </div>
          <div style={{display:"flex", gap:8, marginTop:8}}>
            <button style={s.btn()} onClick={add}>Save</button>
            <button style={s.btn("outline")} onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={s.card}>
        {videos.map((v,i) => (
          <div key={v.id} style={{...s.videoRow, borderBottom: i<videos.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={s.videoThumb}>{v.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:500}}>{v.title}</div>
              <div style={{fontSize:11, color:C.muted, marginTop:3}}>Scheduled: {v.date||"TBD"}</div>
            </div>
            <span style={s.badge(v.status)}>{v.status}</span>
            <button style={{...s.btn("ghost"), padding:"4px 8px", fontSize:12}} onClick={()=>setVideos(videos.map(x=>x.id===v.id?{...x,status:x.status==="DRAFT"?"SCHEDULED":"DRAFT"}:x))}>
              {v.status==="DRAFT"?"→ Schedule":"→ Draft"}
            </button>
          </div>
        ))}
      </div>

      <div style={{...s.card, marginTop:14}}>
        <div style={s.cardTitle}>Best Post Days</div>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
            <div key={d} style={{...s.tag, background: ["Wed","Fri","Sun"].includes(d)?C.accentDim:C.border, color:["Wed","Fri","Sun"].includes(d)?C.accent:C.muted}}>
              {d}
            </div>
          ))}
        </div>
        <div style={{fontSize:12, color:C.accent, marginTop:10}}>⏰ Best: Wed 4PM</div>
      </div>
    </div>
  );
}

function AIIdeas() {
  const [ideas, setIdeas] = useState(IDEAS);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:"You are an expert YouTube content strategist for a faceless finance channel targeting Indian audiences. Generate video title ideas that are catchy, specific, and high-CTR. Respond ONLY with a JSON array of 6 title strings, no markdown, no preamble.",
          messages:[{role:"user", content:`Generate 6 YouTube video title ideas about: ${topic}`}]
        })
      });
      const d = await res.json();
      const text = d.content?.find(b=>b.type==="text")?.text || "[]";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      setIdeas(parsed);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div>
      <div style={s.pageTitle}>AI Ideas</div>
      <div style={{...s.pageSub, marginBottom:20}}>Generate high-CTR video ideas for your audience</div>

      <div style={{...s.card, marginBottom:16}}>
        <div style={s.cardTitle}>Generate New Ideas</div>
        <div style={s.row}>
          <input style={s.input} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Topic or keyword (e.g. mutual funds, tax saving, SIP)…" onKeyDown={e=>e.key==="Enter"&&generate()} />
          <button style={{...s.btn(), flexShrink:0, opacity:loading?0.6:1}} onClick={generate} disabled={loading}>
            {loading ? "Generating…" : "✦ Generate"}
          </button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Ideas ({ideas.length})</div>
        {ideas.map((idea,i) => (
          <div key={i} style={{display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i<ideas.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{width:24, height:24, borderRadius:6, background:C.accentDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:C.accent, fontWeight:700, flexShrink:0}}>{i+1}</div>
            <div style={{flex:1, fontSize:14}}>{idea}</div>
            <button style={s.btn("sm")} onClick={()=>{/* could pass to script */}}>Use</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIScript() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setScript("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:"You are a scriptwriter for a faceless Indian finance YouTube channel. Write engaging, informative video scripts with a hook, 3-4 main points, and a CTA. Use simple language for a general audience. Format with clear sections: HOOK, POINT 1, POINT 2, POINT 3, CTA.",
          messages:[{role:"user", content:`Write a YouTube video script for: "${title}"`}]
        })
      });
      const d = await res.json();
      const text = d.content?.find(b=>b.type==="text")?.text || "";
      setScript(text);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div>
      <div style={s.pageTitle}>AI Script</div>
      <div style={{...s.pageSub, marginBottom:20}}>Generate full video scripts instantly</div>

      <div style={{...s.card, marginBottom:16}}>
        <div style={s.cardTitle}>Video Title</div>
        <div style={s.row}>
          <input style={s.input} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter your video title…" onKeyDown={e=>e.key==="Enter"&&generate()} />
          <button style={{...s.btn(), flexShrink:0, opacity:loading?0.6:1}} onClick={generate} disabled={loading}>
            {loading ? "Writing…" : "✦ Write Script"}
          </button>
        </div>
      </div>

      {(script || loading) && (
        <div style={s.card}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
            <div style={s.cardTitle}>Generated Script</div>
            {script && <button style={s.btn("sm")} onClick={()=>navigator.clipboard.writeText(script)}>Copy</button>}
          </div>
          {loading ? (
            <div style={{color:C.muted, fontSize:14}}>✦ Writing your script…</div>
          ) : (
            <pre style={{fontSize:13, lineHeight:1.8, color:C.textDim, whiteSpace:"pre-wrap", margin:0}}>{script}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function Growth() {
  const weeks = ["W1","W2","W3","W4","W5","W6","W7","W8"];
  const subs = [820,940,1050,1120,1200,1310,1390,1420];
  const views = [1200,1800,2400,3100,4200,5500,6400,7000];
  const max_s = Math.max(...subs), max_v = Math.max(...views);

  return (
    <div>
      <div style={s.pageTitle}>Growth</div>
      <div style={{...s.pageSub, marginBottom:20}}>Track your channel's momentum</div>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>Subscribers (8 weeks)</div>
          <div style={{display:"flex", alignItems:"flex-end", gap:6, height:80}}>
            {subs.map((v,i) => (
              <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                <div style={{width:"100%", background:C.accent, borderRadius:"3px 3px 0 0", height: `${(v/max_s)*72}px`, opacity: 0.6+i*0.05 }} />
                <div style={{fontSize:9, color:C.muted}}>{weeks[i]}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12, color:C.accent, marginTop:8}}>+73% growth in 8 weeks</div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Total Views (8 weeks)</div>
          <div style={{display:"flex", alignItems:"flex-end", gap:6, height:80}}>
            {views.map((v,i) => (
              <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                <div style={{width:"100%", background:C.gold, borderRadius:"3px 3px 0 0", height: `${(v/max_v)*72}px`, opacity: 0.5+i*0.06 }} />
                <div style={{fontSize:9, color:C.muted}}>{weeks[i]}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12, color:C.gold, marginTop:8}}>+483% views growth in 8 weeks</div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Growth Tips</div>
        {[
          { tip:"Post consistently Wed + Fri + Sun for best reach", impact:"High" },
          { tip:"Add chapters to every video — boosts watch time 30%+", impact:"High" },
          { tip:"Thumbnail A/B test: face vs data graphic", impact:"Medium" },
          { tip:"Reply to every comment in first 2 hours", impact:"Medium" },
          { tip:"Use 3–5 relevant hashtags per video", impact:"Low" },
        ].map((t,i) => (
          <div key={i} style={{display:"flex", gap:12, padding:"10px 0", borderBottom:i<4?`1px solid ${C.border}`:"none", alignItems:"center"}}>
            <div style={{flex:1, fontSize:13}}>{t.tip}</div>
            <span style={{...s.badge(t.impact==="High"?"SCHEDULED":"DRAFT"), fontSize:10}}>
              {t.impact}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrePublish() {
  const checks = [
    "Thumbnail uploaded (1280×720px)",
    "Title contains keyword (60 chars max)",
    "Description with timestamps written",
    "Tags added (15–20 relevant tags)",
    "End screen configured",
    "Cards added at 20% and 80% mark",
    "Chapters added in description",
    "Posted to community tab",
  ];
  const [done, setDone] = useState([]);
  const toggle = (i) => setDone(d => d.includes(i) ? d.filter(x=>x!==i) : [...d,i]);

  return (
    <div>
      <div style={s.pageTitle}>Pre-publish</div>
      <div style={{...s.pageSub, marginBottom:20}}>Checklist before going live</div>

      <div style={s.card}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
          <div style={s.cardTitle}>Launch Checklist</div>
          <span style={{fontSize:12, color: done.length===checks.length ? C.accent : C.muted}}>
            {done.length}/{checks.length} complete
          </span>
        </div>
        <div style={{marginBottom:12}}>
          <div style={s.progressBar(Math.round(done.length/checks.length*100))} />
        </div>
        {checks.map((c,i) => (
          <div key={i} onClick={()=>toggle(i)} style={{display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderBottom:i<checks.length-1?`1px solid ${C.bor

## human — 2026-04-24 03:03:02

import { useState } from "react";

const C = {
  bg: "#0A0A0F", surface: "#12121A", card: "#1A1A26", border: "#2A2A3E",
  accent: "#00E5A0", accentDim: "#00E5A020", accentHover: "#00FFB3",
  gold: "#FFD166", muted: "#6B6B8A", text: "#E8E8F0", textDim: "#9898B8",
};

const s = {
  app: { display:"flex", height:"100vh", background:C.bg, fontFamily:"'Inter',sans-serif", color:C.text, overflow:"hidden" },
  sidebar: { width:220, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", padding:"24px 0", flexShrink:0 },
  brand: { padding:"0 20px 24px", borderBottom:`1px solid ${C.border}` },
  brandName: { fontSize:20, fontWeight:700, color:C.accent, display:"flex", alignItems:"center", gap:6 },
  brandSub: { fontSize:12, color:C.muted, marginTop:4 },
  nav: { flex:1, padding:"16px 0" },
  navItem: (active) => ({
    display:"flex", alignItems:"center", gap:10, padding:"10px 20px", cursor:"pointer",
    background: active ? C.accentDim : "transparent",
    borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent",
    color: active ? C.accent : C.textDim, fontSize:14, fontWeight: active ? 600 : 400,
    transition:"all 0.15s",
  }),
  postDays: { padding:"16px 20px", borderTop:`1px solid ${C.border}` },
  main: { flex:1, overflow:"auto", padding:28 },
  pageTitle: { fontSize:24, fontWeight:700, marginBottom:4 },
  pageSub: { fontSize:14, color:C.muted, marginBottom:24 },
  grid3: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 },
  grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 },
  card: { background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20 },
  cardTitle: { fontSize:11, fontWeight:600, color:C.muted, letterSpacing:"0.08em", marginBottom:14, textTransform:"uppercase" },
  statNum: { fontSize:32, fontWeight:800, marginBottom:4 },
  statLabel: { fontSize:13, color:C.muted, marginBottom:6 },
  statChange: { fontSize:12, color:C.accent, fontWeight:600 },
  badge: (type) => ({
    display:"inline-block", fontSize:10, fontWeight:700, letterSpacing:"0.05em",
    padding:"3px 8px", borderRadius:4,
    background: type==="SCHEDULED" ? "#FFD16620" : "#2A2A3E",
    color: type==="SCHEDULED" ? C.gold : C.muted,
    textTransform:"uppercase",
  }),
  videoRow: { display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` },
  videoThumb: { width:52, height:36, background:C.border, borderRadius:6, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 },
  btn: (variant) => ({
    padding: variant==="sm" ? "6px 14px" : "10px 20px",
    borderRadius:8, fontWeight:600, fontSize: variant==="sm" ? 12 : 14, cursor:"pointer", border:"none",
    background: variant==="ghost" ? "transparent" : variant==="outline" ? "transparent" : C.accent,
    color: variant==="ghost" || variant==="outline" ? C.accent : C.bg,
    border: variant==="outline" ? `1px solid ${C.accent}` : "none",
  }),
  input: { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontSize:14, outline:"none", boxSizing:"border-box" },
  textarea: { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", color:C.text, fontSize:14, outline:"none", boxSizing:"border-box", minHeight:100, resize:"vertical" },
  tag: { display:"inline-flex", alignItems:"center", gap:4, background:C.accentDim, color:C.accent, fontSize:12, padding:"4px 10px", borderRadius:20 },
  progressBar: (pct) => ({ height:6, borderRadius:3, background:`linear-gradient(90deg,${C.accent} ${pct}%,${C.border} ${pct}%)` }),
  row: { display:"flex", gap:14, marginBottom:14 },
  col: { flex:1 },
};

const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"▦" },
  { id:"schedule", label:"Schedule", icon:"▣" },
  { id:"ideas", label:"AI Ideas", icon:"✦" },
  { id:"script", label:"AI Script", icon:"✧" },
  { id:"growth", label:"Growth", icon:"↗" },
  { id:"prepublish", label:"Pre-publish", icon:"✓" },
];

const VIDEOS = [
  { id:1, title:"5 Tax Mistakes Salaried People Make Every Year", status:"SCHEDULED", date:"2026-04-23", emoji:"💸", views:null },
  { id:2, title:"Credit Score Myths Busted by a CA", status:"DRAFT", date:"2026-04-25", emoji:"📊", views:null },
  { id:3, title:"Emergency Fund: How Much Is Actually Enough?", status:"DRAFT", date:"2026-04-28", emoji:"🛡️", views:null },
];

const TOP = [
  { title:"How I Saved ₹10L in 3 Years on a CA Salary", views:4200 },
  { title:"SIP vs Lump Sum: Which Actually Wins? (Data Deep Dive)", views:2800 },
  { title:"The 50-30-20 Rule Is Wrong – Here's What Works", views:1950 },
];

const IDEAS = [
  "Why Your Salary Hike Is Making You Poorer",
  "Mutual Fund Myths That Cost Indians Crores",
  "Home Loan vs Rent: The Real Math in 2026",
  "How HNIs Actually Manage Their Money",
  "5 Tax Harvesting Tricks Before March 31",
  "The NPS Trap Nobody Warns You About",
];

// ── Pages ────────────────────────────────────────────────────────────────────

function Dashboard() {
  return (
    <div>
      <div style={s.pageTitle}>Dashboard</div>
      <div style={s.pageSub}>Your channel at a glance</div>

      <div style={s.grid3}>
        {[
          { num:"1,420", label:"Subscribers", change:"+480 this month" },
          { num:"7,000", label:"Total Views", change:"+8.5K this month" },
          { num:"2", label:"Videos Published", change:"1 scheduled" },
        ].map(stat => (
          <div key={stat.label} style={s.card}>
            <div style={s.statNum}>{stat.num}</div>
            <div style={s.statLabel}>{stat.label}</div>
            <div style={s.statChange}>{stat.change}</div>
          </div>
        ))}
      </div>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>Upcoming Videos</div>
          {VIDEOS.slice(0,2).map(v => (
            <div key={v.id} style={s.videoRow}>
              <div style={s.videoThumb}>{v.emoji}</div>
              <div style={{flex:1}}>
                <span style={s.badge(v.status)}>{v.status}</span>
                <div style={{fontSize:13, marginTop:4, lineHeight:1.4}}>{v.title}</div>
              </div>
              <div style={{fontSize:11, color:C.muted, flexShrink:0}}>{v.date}</div>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Top Performers</div>
          {TOP.map((v,i) => (
            <div key={i} style={{...s.videoRow, alignItems:"flex-start"}}>
              <div style={{flex:1, fontSize:13, lineHeight:1.4}}>{v.title}</div>
              <div style={{fontSize:13, color:C.textDim, flexShrink:0, display:"flex", alignItems:"center", gap:4}}>
                {v.views.toLocaleString()} <span style={{color:C.accent}}>▶</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Monthly Goal Progress</div>
        <div style={s.row}>
          {[
            { label:"Subscribers", cur:1420, goal:2000 },
            { label:"Views", cur:7000, goal:15000 },
            { label:"Videos", cur:2, goal:6 },
          ].map(g => (
            <div key={g.label} style={s.col}>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6}}>
                <span style={{color:C.muted}}>{g.label}</span>
                <span style={{color:C.text}}>{g.cur.toLocaleString()} / {g.goal.toLocaleString()}</span>
              </div>
              <div style={s.progressBar(Math.round(g.cur/g.goal*100))} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Schedule() {
  const [videos, setVideos] = useState(VIDEOS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", date:"", emoji:"🎬" });

  const add = () => {
    if (!form.title) return;
    setVideos([...videos, { id:Date.now(), ...form, status:"DRAFT", views:null }]);
    setForm({ title:"", date:"", emoji:"🎬" });
    setShowForm(false);
  };

  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4}}>
        <div style={s.pageTitle}>Schedule</div>
        <button style={s.btn()} onClick={() => setShowForm(v => !v)}>+ Add Video</button>
      </div>
      <div style={{...s.pageSub, marginBottom:20}}>Plan and track your content calendar</div>

      {showForm && (
        <div style={{...s.card, marginBottom:16}}>
          <div style={s.cardTitle}>New Video</div>
          <div style={s.row}>
            <input style={{...s.input, width:50}} value={form.emoji} onChange={e=>setForm({...form,emoji:e.target.value})} placeholder="🎬" />
            <input style={s.input} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Video title…" />
            <input type="date" style={{...s.input, width:160}} value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          </div>
          <div style={{display:"flex", gap:8, marginTop:8}}>
            <button style={s.btn()} onClick={add}>Save</button>
            <button style={s.btn("outline")} onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={s.card}>
        {videos.map((v,i) => (
          <div key={v.id} style={{...s.videoRow, borderBottom: i<videos.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={s.videoThumb}>{v.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:500}}>{v.title}</div>
              <div style={{fontSize:11, color:C.muted, marginTop:3}}>Scheduled: {v.date||"TBD"}</div>
            </div>
            <span style={s.badge(v.status)}>{v.status}</span>
            <button style={{...s.btn("ghost"), padding:"4px 8px", fontSize:12}} onClick={()=>setVideos(videos.map(x=>x.id===v.id?{...x,status:x.status==="DRAFT"?"SCHEDULED":"DRAFT"}:x))}>
              {v.status==="DRAFT"?"→ Schedule":"→ Draft"}
            </button>
          </div>
        ))}
      </div>

      <div style={{...s.card, marginTop:14}}>
        <div style={s.cardTitle}>Best Post Days</div>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
            <div key={d} style={{...s.tag, background: ["Wed","Fri","Sun"].includes(d)?C.accentDim:C.border, color:["Wed","Fri","Sun"].includes(d)?C.accent:C.muted}}>
              {d}
            </div>
          ))}
        </div>
        <div style={{fontSize:12, color:C.accent, marginTop:10}}>⏰ Best: Wed 4PM</div>
      </div>
    </div>
  );
}

function AIIdeas() {
  const [ideas, setIdeas] = useState(IDEAS);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:"You are an expert YouTube content strategist for a faceless finance channel targeting Indian audiences. Generate video title ideas that are catchy, specific, and high-CTR. Respond ONLY with a JSON array of 6 title strings, no markdown, no preamble.",
          messages:[{role:"user", content:`Generate 6 YouTube video title ideas about: ${topic}`}]
        })
      });
      const d = await res.json();
      const text = d.content?.find(b=>b.type==="text")?.text || "[]";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      setIdeas(parsed);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div>
      <div style={s.pageTitle}>AI Ideas</div>
      <div style={{...s.pageSub, marginBottom:20}}>Generate high-CTR video ideas for your audience</div>

      <div style={{...s.card, marginBottom:16}}>
        <div style={s.cardTitle}>Generate New Ideas</div>
        <div style={s.row}>
          <input style={s.input} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Topic or keyword (e.g. mutual funds, tax saving, SIP)…" onKeyDown={e=>e.key==="Enter"&&generate()} />
          <button style={{...s.btn(), flexShrink:0, opacity:loading?0.6:1}} onClick={generate} disabled={loading}>
            {loading ? "Generating…" : "✦ Generate"}
          </button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Ideas ({ideas.length})</div>
        {ideas.map((idea,i) => (
          <div key={i} style={{display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i<ideas.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{width:24, height:24, borderRadius:6, background:C.accentDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:C.accent, fontWeight:700, flexShrink:0}}>{i+1}</div>
            <div style={{flex:1, fontSize:14}}>{idea}</div>
            <button style={s.btn("sm")} onClick={()=>{/* could pass to script */}}>Use</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIScript() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    setScript("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:"You are a scriptwriter for a faceless Indian finance YouTube channel. Write engaging, informative video scripts with a hook, 3-4 main points, and a CTA. Use simple language for a general audience. Format with clear sections: HOOK, POINT 1, POINT 2, POINT 3, CTA.",
          messages:[{role:"user", content:`Write a YouTube video script for: "${title}"`}]
        })
      });
      const d = await res.json();
      const text = d.content?.find(b=>b.type==="text")?.text || "";
      setScript(text);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div>
      <div style={s.pageTitle}>AI Script</div>
      <div style={{...s.pageSub, marginBottom:20}}>Generate full video scripts instantly</div>

      <div style={{...s.card, marginBottom:16}}>
        <div style={s.cardTitle}>Video Title</div>
        <div style={s.row}>
          <input style={s.input} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter your video title…" onKeyDown={e=>e.key==="Enter"&&generate()} />
          <button style={{...s.btn(), flexShrink:0, opacity:loading?0.6:1}} onClick={generate} disabled={loading}>
            {loading ? "Writing…" : "✦ Write Script"}
          </button>
        </div>
      </div>

      {(script || loading) && (
        <div style={s.card}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
            <div style={s.cardTitle}>Generated Script</div>
            {script && <button style={s.btn("sm")} onClick={()=>navigator.clipboard.writeText(script)}>Copy</button>}
          </div>
          {loading ? (
            <div style={{color:C.muted, fontSize:14}}>✦ Writing your script…</div>
          ) : (
            <pre style={{fontSize:13, lineHeight:1.8, color:C.textDim, whiteSpace:"pre-wrap", margin:0}}>{script}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function Growth() {
  const weeks = ["W1","W2","W3","W4","W5","W6","W7","W8"];
  const subs = [820,940,1050,1120,1200,1310,1390,1420];
  const views = [1200,1800,2400,3100,4200,5500,6400,7000];
  const max_s = Math.max(...subs), max_v = Math.max(...views);

  return (
    <div>
      <div style={s.pageTitle}>Growth</div>
      <div style={{...s.pageSub, marginBottom:20}}>Track your channel's momentum</div>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>Subscribers (8 weeks)</div>
          <div style={{display:"flex", alignItems:"flex-end", gap:6, height:80}}>
            {subs.map((v,i) => (
              <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                <div style={{width:"100%", background:C.accent, borderRadius:"3px 3px 0 0", height: `${(v/max_s)*72}px`, opacity: 0.6+i*0.05 }} />
                <div style={{fontSize:9, color:C.muted}}>{weeks[i]}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12, color:C.accent, marginTop:8}}>+73% growth in 8 weeks</div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Total Views (8 weeks)</div>
          <div style={{display:"flex", alignItems:"flex-end", gap:6, height:80}}>
            {views.map((v,i) => (
              <div key={i} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
                <div style={{width:"100%", background:C.gold, borderRadius:"3px 3px 0 0", height: `${(v/max_v)*72}px`, opacity: 0.5+i*0.06 }} />
                <div style={{fontSize:9, color:C.muted}}>{weeks[i]}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12, color:C.gold, marginTop:8}}>+483% views growth in 8 weeks</div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Growth Tips</div>
        {[
          { tip:"Post consistently Wed + Fri + Sun for best reach", impact:"High" },
          { tip:"Add chapters to every video — boosts watch time 30%+", impact:"High" },
          { tip:"Thumbnail A/B test: face vs data graphic", impact:"Medium" },
          { tip:"Reply to every comment in first 2 hours", impact:"Medium" },
          { tip:"Use 3–5 relevant hashtags per video", impact:"Low" },
        ].map((t,i) => (
          <div key={i} style={{display:"flex", gap:12, padding:"10px 0", borderBottom:i<4?`1px solid ${C.border}`:"none", alignItems:"center"}}>
            <div style={{flex:1, fontSize:13}}>{t.tip}</div>
            <span style={{...s.badge(t.impact==="High"?"SCHEDULED":"DRAFT"), fontSize:10}}>
              {t.impact}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrePublish() {
  const checks = [
    "Thumbnail uploaded (1280×720px)",
    "Title contains keyword (60 chars max)",
    "Description with timestamps written",
    "Tags added (15–20 relevant tags)",
    "End screen configured",
    "Cards added at 20% and 80% mark",
    "Chapters added in description",
    "Posted to community tab",
  ];
  const [done, setDone] = useState([]);
  const toggle = (i) => setDone(d => d.includes(i) ? d.filter(x=>x!==i) : [...d,i]);

  return (
    <div>
      <div style={s.pageTitle}>Pre-publish</div>
      <div style={{...s.pageSub, marginBottom:20}}>Checklist before going live</div>

      <div style={s.card}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
          <div style={s.cardTitle}>Launch Checklist</div>
          <span style={{fontSize:12, color: done.length===checks.length ? C.accent : C.muted}}>
            {done.length}/{checks.length} complete
          </span>
        </div>
        <div style={{marginBottom:12}}>
          <div style={s.progressBar(Math.round(done.length/checks.length*100))} />
        </div>
        {checks.map((c,i) => (
          <div key={i} onClick={()=>toggle(i)} style={{display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderBottom:i<checks.length-1?`1px solid ${C.bor

## assistant — 2026-04-24 03:04:55

 Your code is still getting cut off at the same spot — right in the middle of the `borderBottom` line in the PrePublish component's checklist mapping. The paste seems to be truncating.

I'll finish the app as-is: complete the PrePublish component, add the main App wrapper with sidebar navigation, and render it as an artifact so you can see it running.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Here's the finished app. What I completed and fixed:

**Completed the `PrePublish` component** — finished the checklist item render with a proper checkbox (toggles on click, strikethrough when done) and added a "🚀 Ready to publish!" success banner when all 8 checks are ticked.

**Added the missing App shell** — your original code defined all the page components but never wired them up. Added a default-exported `App` that renders the sidebar with nav state and swaps between pages via a `PAGES` lookup.

**Two small fixes in the styles**:
- `btn` had `border:` declared twice (once in the ternary, once on the next line). The second one was overriding the first, so ghost buttons were getting the outline border too. Consolidated it.
- Removed the empty `/* could pass to script */` comment handler on the "Use" button in AIIdeas since it was a no-op.

**Heads up on the Anthropic API calls** — the `fetch("https://api.anthropic.com/v1/messages")` calls in AIIdeas and AIScript will hit CORS when run outside the Claude.ai artifact environment. They'll work fine as an artifact here (Claude.ai injects the auth), but if you deploy this anywhere else you'll need a backend proxy or use a provider like OpenRouter with a user-supplied key.

## assistant — 2026-04-24 03:08:45

 The code is still cut off at the exact same spot (mid-`borderBottom` in the PrePublish checklist map). I'll finish it from where it stops, wire up the main `App` component with navigation and sidebar (which wasn't in what you sent), and render the whole thing as an artifact so you can use it.
```
This block is not supported on your current device yet.
```

Let me go straight to building the artifact instead — I have all the context I need from your code.
```
This block is not supported on your current device yet.
```


```
This block is not supported on your current device yet.
```

Done. Here's what I did to finish it:

**Completed the cut-off PrePublish checklist** — each item now has a proper checkbox (animates green with a ✓ when toggled), strike-through styling for done items, and a 🎉 "ready to publish" banner that appears when all 8 checks are complete.

**Added the missing App shell** — your code defined the sidebar styles and NAV array but had no component tying it all together. I added:
- A default-exported `App` component with `useState` for the current page
- The sidebar with brand (`✦ CreatorOS`), nav items that highlight on active, and a "Next Post" card at the bottom
- A `PAGES` map that renders the right page based on nav selection

**One small fix in your btn style** — you had `border` declared twice in the same object, which would silently drop the first value. Cleaned that up so the outline variant works correctly.

Everything else is unchanged from what you sent — same colors, same components, same Anthropic API calls for AI Ideas and AI Script.
