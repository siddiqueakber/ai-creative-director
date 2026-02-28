'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

interface ThoughtInputProps {
  onSubmit: (text: string) => void
  isLoading: boolean
  disabled?: boolean
}

export function ThoughtInput({ onSubmit, isLoading, disabled }: ThoughtInputProps) {
  const [text, setText] = useState('')

  const handleSubmit = useCallback(() => {
    if (!text.trim() || isLoading || disabled) return
    onSubmit(text.trim())
  }, [text, isLoading, disabled, onSubmit])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-sm font-semibold text-[var(--sage-800)]">What&apos;s on your mind?</div>
          <div className="text-xs text-[var(--sage-500)]">We&apos;ll turn it into a short film that puts it in perspective.</div>
        </div>
      </div>

      <motion.div className="relative">
        <div className="relative glass elevated-premium rounded-3xl p-6 lg:p-8 border border-white/30 ring-1 ring-white/20">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="I'm worried about… / I can't stop thinking about…"
            aria-label="What's on your mind"
            disabled={isLoading || disabled}
            maxLength={500}
            className="w-full min-h-[160px] p-4 bg-white/70 dark:bg-white/10 rounded-2xl
                     border-2 border-white/40 dark:border-white/20 
                     focus:border-[var(--sage-400)] dark:focus:border-[var(--sage-400)]
                     focus:ring-[3px] focus:ring-[var(--sage-400)]/25
                     text-primary placeholder:text-muted
                     text-base md:text-lg leading-relaxed
                     resize-none transition-all duration-300 ease-[var(--ease-smooth)]
                     disabled:opacity-60 disabled:cursor-not-allowed
                     shadow-inner focus:shadow-lg"
          />

          {/* Character count */}
          <div className={[
            "flex items-center justify-end mt-2 text-xs transition-opacity duration-200",
            text.length > 0 ? "opacity-60" : "opacity-0"
          ].join(' ')}>
            <span className={text.length >= 450 ? "text-amber-600 font-medium" : "text-muted"}>
              {text.length}/500
            </span>
          </div>

          <div className="flex items-center justify-end mt-3">
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || isLoading || disabled}
              className="px-6 py-3 bg-gradient-to-r from-[var(--sage-600)] to-[var(--sage-700)]
                       hover:from-[var(--sage-700)] hover:to-[var(--sage-800)]
                       disabled:from-[var(--sage-300)] disabled:to-[var(--sage-400)] disabled:cursor-not-allowed
                       text-white font-semibold rounded-2xl
                       transition-all duration-300 ease-[var(--ease-smooth)]
                       hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(45,54,45,0.1),0_8px_16px_rgba(45,54,45,0.15),0_20px_40px_rgba(45,54,45,0.2)]
                       hover:scale-[1.02]
                       active:shadow-inner active:translate-y-px active:scale-[0.98]
                       shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]
                       flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <motion.div
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  Working...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Create my film
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
