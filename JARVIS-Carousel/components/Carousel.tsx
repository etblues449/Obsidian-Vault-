'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Slide = {
  id: number
  title: string
  section: string
  number: string
  content: React.ReactNode
}

const slides: Slide[] = [
  {
    id: 0,
    section: 'MEET JARVIS',
    number: '01',
    title: 'Built with Fable. Runs on anything.',
    content: (
      <div className="space-y-6">
        <p className="text-lg">
          JARVIS was <span className="text-coral font-semibold">built with Fable 5</span> — but Fable isn't required to run it:
        </p>
        <ul className="space-y-3">
          <li className="flex gap-3">
            <span className="text-coral text-xl">▪</span>
            <span>Runs on <span className="text-coral font-semibold">any local model</span> you point it at.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-coral text-xl">▪</span>
            <span><span className="text-coral font-semibold">Fully customizable + modular</span> — swap any piece.</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 1,
    section: 'THE COMMAND CENTER',
    number: '02',
    title: 'A voice layer over Claude Code + Obsidian.',
    content: (
      <div className="space-y-8">
        <p className="text-lg">
          JARVIS is a voice-activated layer that sits on top of <span className="text-coral font-semibold">both Claude Code and Obsidian</span> — speak, and it routes the work.
        </p>
        <div className="bg-white/5 border border-white/10 rounded p-6">
          <div className="flex justify-between items-start mb-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-2 bg-coral/20 rounded flex items-center justify-center">
                <span className="text-2xl">✨</span>
              </div>
              <p className="font-mono text-sm font-semibold">JARVIS</p>
              <p className="text-xs text-white/60 uppercase tracking-wide">Voice Command Center</p>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-orange/20 rounded flex items-center justify-center">
                  <span className="text-2xl">🔧</span>
                </div>
                <p className="font-mono text-sm font-semibold">CLAUDE CODE</p>
                <p className="text-xs text-white/60 uppercase tracking-wide">The Engine</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 bg-purple-500/20 rounded flex items-center justify-center">
                  <span className="text-2xl">🧠</span>
                </div>
                <p className="font-mono text-sm font-semibold">OBSIDIAN</p>
                <p className="text-xs text-white/60 uppercase tracking-wide">The Memory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    section: 'THE BACKBONE',
    number: '03',
    title: 'Everything routes through Claude Code.',
    content: (
      <div className="space-y-8">
        <p className="text-lg">
          Every request runs the same loop — JARVIS hands it to <span className="text-coral font-semibold">Claude Code</span>, which pulls only the <span className="text-coral font-semibold">skills</span> the moment needs, then sends the answer back.
        </p>
        <div className="bg-white/5 border border-white/10 rounded p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-12 bg-white/5 rounded flex items-center px-4 font-mono text-sm">Request</div>
              <span className="text-coral">→</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-12 bg-white/5 rounded flex items-center px-4 font-semibold text-sm">JARVIS</div>
              <span className="text-coral">→</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-12 bg-coral/20 rounded flex items-center px-4 font-semibold text-sm text-coral">Claude Code</div>
              <span className="text-coral">→</span>
            </div>
            <div className="bg-white/5 rounded p-4 ml-0">
              <p className="font-mono text-xs uppercase text-white/60 mb-2">Skills</p>
              <div className="space-y-1 text-sm font-mono">
                <div>voice/ SKILL.md</div>
                <div>vault/ SKILL.md</div>
                <div>metrics/ SKILL.md</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-coral">→</span>
              <div className="flex-1 h-12 bg-white/5 rounded flex items-center px-4 font-mono text-sm">Spoken Response</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 3,
    section: 'THE SECOND BRAIN',
    number: '04',
    title: 'An Obsidian second brain.',
    content: (
      <div className="space-y-8">
        <p className="text-lg">
          Every report lands as <span className="text-coral font-semibold">markdown</span> in the vault, modeled on the <span className="text-coral font-semibold">Karpathy system</span>. The linked graph lets JARVIS answer <span className="text-coral font-semibold">fast + accurately</span> — no database.
        </p>
        <div className="bg-white/5 border border-white/10 rounded p-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="font-mono text-xs uppercase text-white/60 mb-4">JARVIS Query</p>
              <div className="space-y-2 text-sm">
                <div className="text-coral font-semibold">WRITES MD</div>
                <div className="text-white/60">↓</div>
                <div className="text-coral font-semibold">ANSWERS</div>
              </div>
            </div>
            <div>
              <p className="font-mono text-xs uppercase text-white/60 mb-4">Obsidian Vault</p>
              <div className="space-y-2 text-sm">
                <div className="inline-block px-2 py-1 bg-white/10 rounded">raw/</div>
                <div className="text-white/60">captures</div>
                <div className="inline-block px-2 py-1 bg-white/10 rounded ml-4">wiki/</div>
                <div className="text-white/60">linked notes</div>
                <div className="inline-block px-2 py-1 bg-white/10 rounded ml-8">outputs/</div>
                <div className="text-white/60">deliverables</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 4,
    section: 'THE VOICE',
    number: '05',
    title: 'Voice that runs 100% local.',
    content: (
      <div className="space-y-8">
        <p className="text-lg">
          Mic in → <span className="text-coral font-semibold">faster-whisper</span> transcribes locally → <span className="text-coral font-semibold">Kokoro</span> speaks back. Responsive, private, and <span className="text-coral font-semibold">essentially free</span>.
        </p>
        <div className="space-y-3">
          <div className="bg-white/5 border border-white/10 rounded p-4">
            <div className="flex items-start gap-3">
              <span className="text-coral">▪</span>
              <div>
                <p className="font-mono text-sm font-semibold">SYSTRAN/faster-whisper</p>
                <p className="text-sm text-white/60">Faster Whisper transcription with CTranslate2</p>
                <p className="text-xs text-coral mt-1">23.6k ⭐ • Python</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded p-4">
            <div className="flex items-start gap-3">
              <span className="text-coral">▪</span>
              <div>
                <p className="font-mono text-sm font-semibold">hexgrad/kokoro</p>
                <p className="text-sm text-white/60">Open-weight 82M-parameter text-to-speech</p>
                <p className="text-xs text-coral mt-1">7.5k ⭐ • Python</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 5,
    section: 'MAKE IT YOURS',
    number: '06',
    title: 'A skeleton to build on.',
    content: (
      <div className="space-y-8">
        <p className="text-lg">
          Modular to the core — <span className="text-coral font-semibold">reskin the UI</span> into whatever you want and <span className="text-coral font-semibold">fork it per client or teammate</span>. One skeleton, infinite builds.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-b from-coral/20 to-transparent border border-coral/30 rounded p-6 text-center">
            <div className="w-full h-12 bg-coral/30 rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-2 bg-white/10 rounded"></div>
              <div className="h-2 bg-white/10 rounded"></div>
              <div className="h-4 bg-coral/30 rounded mt-4"></div>
            </div>
            <p className="mt-6 font-semibold">YOU</p>
          </div>
          <div className="bg-gradient-to-b from-blue-500/20 to-transparent border border-blue-500/30 rounded p-6 text-center">
            <div className="w-full h-12 bg-blue-500/30 rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-2 bg-white/10 rounded"></div>
              <div className="h-2 bg-white/10 rounded"></div>
              <div className="h-4 bg-blue-500/30 rounded mt-4"></div>
            </div>
            <p className="mt-6 font-semibold">CLIENT</p>
          </div>
          <div className="bg-gradient-to-b from-purple-500/20 to-transparent border border-purple-500/30 rounded p-6 text-center">
            <div className="w-full h-12 bg-purple-500/30 rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-2 bg-white/10 rounded"></div>
              <div className="h-2 bg-white/10 rounded"></div>
              <div className="h-4 bg-purple-500/30 rounded mt-4"></div>
            </div>
            <p className="mt-6 font-semibold">TEAM</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 6,
    section: 'YOUR MOVE',
    number: '07',
    title: 'Get JARVIS.',
    content: (
      <div className="space-y-8">
        <div className="bg-white/5 border border-white/10 rounded p-8 text-center">
          <p className="text-2xl font-bold mb-4">Build it for yourself.</p>
          <p className="text-lg mb-2">
            <span className="text-coral font-semibold underline cursor-pointer hover:opacity-80">Check the description</span> to grab this.
          </p>
          <p className="text-white/60">
            Save this · send it to a builder · <span className="text-coral font-semibold">follow @jarvis.ai</span>
          </p>
        </div>
      </div>
    ),
  },
]

export default function Carousel() {
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(0)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  }

  const paginate = (newDirection: number) => {
    setDirection(newDirection)
    setCurrent((prev) => (prev + newDirection + slides.length) % slides.length)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') paginate(-1)
    if (e.key === 'ArrowRight') paginate(1)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX.current
    if (diff > 50) paginate(1)
    if (diff < -50) paginate(-1)
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      className="w-screen h-screen bg-black overflow-hidden flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="h-20 border-b border-white/10 flex items-center px-6 justify-between bg-black/50 backdrop-blur-sm">
        <div className="text-white/40 text-sm font-mono tracking-widest">STEM</div>
        <div className="flex gap-8 items-center">
          <button className="text-white/40 hover:text-white text-sm">Following</button>
          <button className="text-white font-semibold text-sm">For You</button>
          <button className="text-white/40 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <span className="text-xs">⚙</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 relative">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={current}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="absolute inset-0 flex flex-col bg-gradient-to-b from-black to-cream"
            >
              <div className="flex-1 flex flex-col justify-center px-12 py-12 space-y-8 max-w-2xl">
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <p className="text-xs uppercase tracking-widest text-white/60 font-mono">
                      {slides[current].section}
                    </p>
                    <p className="text-xs uppercase tracking-widest text-coral/60 font-mono">
                      {slides[current].number} / 07
                    </p>
                  </div>
                  <div className="h-px bg-white/20"></div>
                </div>

                <div className="space-y-6">
                  <h1 className="text-5xl font-bold leading-tight">
                    {slides[current].title.split(/([\w\s]+)/g).map((part, i) => {
                      const isHighlight = slides[current].content && typeof slides[current].content !== 'string'
                      return part && /[\w]/.test(part) ? (
                        <span key={i} className={
                          ['for', 'over', 'through', 'local', 'an', 'to', 'Fable', 'Claude Code', 'Obsidian', 'any', 'fully', '100%'].some(word => part.includes(word))
                            ? 'text-coral'
                            : ''
                        }>
                          {part}
                        </span>
                      ) : (
                        part
                      )
                    })}
                  </h1>
                </div>

                <div className="text-base leading-relaxed text-white/80">
                  {slides[current].content}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom controls */}
        <div className="border-t border-white/10 bg-black/50 backdrop-blur-sm px-6 py-4 flex justify-between items-center">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > current ? 1 : -1)
                  setCurrent(i)
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === current ? 'bg-coral w-8' : 'bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => paginate(-1)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition"
            >
              ←
            </button>
            <button
              onClick={() => paginate(1)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 bg-black px-6 py-4 text-xs text-white/40 font-mono">
        Built with Next.js · Deployed on Vercel
      </div>
    </div>
  )
}
