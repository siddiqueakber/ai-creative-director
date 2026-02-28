'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CognitiveAnalysis, EssayResult } from '@/types'
import { SectionIcon } from './SectionIcon'
import { AnimatedDivider } from './AnimatedDivider'

interface ReframeCardProps {
  originalThought: string
  analysis: CognitiveAnalysis
  reframe: EssayResult
  onGenerateVideo: () => void
  isGeneratingVideo: boolean
}

export function ReframeCard({
  originalThought,
  analysis,
  reframe,
  onGenerateVideo,
  isGeneratingVideo
}: ReframeCardProps) {
  const [outlineExpanded, setOutlineExpanded] = useState(true)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-3xl mx-auto space-y-6"
    >
      <div className="relative glass elevated elevated-premium rounded-3xl p-8 lg:p-10 border border-white/30 space-y-8 transition-all duration-300 hover:shadow-2xl overflow-hidden">
        {/* Decorative Pattern Background */}
        <div className="decorative-pattern" />

        {/* Floating Decorative Orbs */}
        <motion.div
          className="absolute -top-20 -right-10 w-40 h-40 rounded-full opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, var(--lavender-soft), transparent)'
          }}
          animate={{
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, var(--sky-gentle), transparent)'
          }}
          animate={{
            y: [0, 20, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />

        {/* Corner Decoration */}
        <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-30">
          <svg className="w-full h-full text-[var(--sage-200)] dark:text-[var(--sage-700)]" viewBox="0 0 100 100">
            <motion.path
              d="M0,0 Q50,25 100,0 L100,100 Q50,75 0,100 Z"
              fill="currentColor"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: 0.3 }}
            />
          </svg>
        </div>

        {/* Your Prompt Section */}
        <div className="relative pb-6">
          <div className="flex items-center gap-3 mb-3">
            <SectionIcon type="prompt" delay={0.1} />
            <div className="text-sm uppercase tracking-wider text-muted font-medium">Your prompt</div>
          </div>
          <div className="text-xl font-serif text-primary mt-3 leading-loose">"{originalThought}"</div>
        </div>

        <AnimatedDivider />

        {/* Essay Angle Section */}
        <div className="relative py-6">
          <div className="flex items-center gap-3 mb-3">
            <SectionIcon type="angle" delay={0.2} />
            <div className="text-sm uppercase tracking-wider text-muted font-medium">Essay angle</div>
          </div>
          <div className="text-lg font-medium text-primary mt-3 leading-loose">{reframe.thesis}</div>
        </div>

        <AnimatedDivider />

        {/* Collapsible Outline Section */}
        {reframe.outline?.length ? (
          <div className="relative py-6">
            <button
              onClick={() => setOutlineExpanded(!outlineExpanded)}
              className="flex items-center justify-between w-full group mb-4"
            >
              <div className="flex items-center gap-3">
                <SectionIcon type="outline" delay={0.3} />
                <div className="text-sm uppercase tracking-wider text-muted font-medium">
                  Outline
                </div>
              </div>
              <motion.svg
                className="w-5 h-5 text-muted group-hover:text-primary transition-colors"
                animate={{ rotate: outlineExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </motion.svg>
            </button>

            <AnimatePresence initial={false}>
              {outlineExpanded && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-4 space-y-3 text-base text-primary overflow-hidden"
                >
                  {reframe.outline.map((point, index) => (
                    <motion.li
                      key={`${index}-${point}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.4 }}
                      className="flex items-start gap-2"
                    >
                      <span className="text-[var(--sage-500)] mt-1">•</span>
                      <span>{point}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        ) : null}

        <AnimatedDivider />

        {/* Emotion Badge with Glow */}
        <div className="flex justify-center pt-3">
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-full bg-[var(--sage-400)]/20 blur-xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full
                            bg-gradient-to-r from-[var(--sage-100)] to-[var(--sage-200)] 
                            dark:from-[var(--sage-800)] dark:to-[var(--sage-900)] shadow-lg">
              <div className="w-2 h-2 rounded-full bg-[var(--sage-500)] animate-pulse" />
              <span className="text-sm font-medium text-primary capitalize">{analysis.emotion}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Video Button with Magnetic Effect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="flex justify-center pt-2"
      >
        <motion.button
          onClick={onGenerateVideo}
          disabled={isGeneratingVideo}
          onMouseMove={(e) => {
            if (isGeneratingVideo) return
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left - rect.width / 2
            const y = e.clientY - rect.top - rect.height / 2
            setMousePosition({ x: x * 0.1, y: y * 0.1 })
          }}
          onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
          animate={{ x: mousePosition.x, y: mousePosition.y }}
          transition={{ type: "spring", stiffness: 150, damping: 15 }}
          className="group px-8 py-4 bg-gradient-to-r from-[var(--sage-600)] to-[var(--sage-700)]
                   hover:from-[var(--sage-700)] hover:to-[var(--sage-800)]
                   disabled:from-[var(--sage-300)] disabled:to-[var(--sage-400)]
                   text-white font-semibold rounded-2xl
                   transition-all duration-300 ease-[var(--ease-smooth)]
                   hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(45,54,45,0.1),0_8px_16px_rgba(45,54,45,0.15),0_24px_48px_rgba(45,54,45,0.2)]
                   hover:scale-[1.03]
                   active:shadow-inner active:translate-y-px active:scale-[0.98]
                   shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]
                   flex items-center gap-3
                   disabled:cursor-not-allowed disabled:scale-100"
        >
          {isGeneratingVideo ? (
            <>
              <motion.div
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              Generating video...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Generate video
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
