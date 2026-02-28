'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface DisclaimerModalProps {
  isOpen: boolean
  onAccept: () => void
}

export function DisclaimerModal({ isOpen, onAccept }: DisclaimerModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-lg"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass elevated elevated-premium rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-white/25 dark:border-white/15"
          >
            <div className="p-8">
              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--sage-100)] to-[var(--sage-200)] dark:from-[var(--sage-800)] dark:to-[var(--sage-900)] flex items-center justify-center shadow-md shadow-inner">
                  <svg className="w-6 h-6 text-[var(--sage-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-primary">Welcome to Orbit</h2>
                  <p className="text-sm text-secondary mt-1">A quick note before you begin</p>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-5 text-secondary">
                <p className="text-base leading-relaxed">
                  Orbit is a <strong className="text-primary font-semibold">creative reflection tool</strong> that turns philosophical prompts into
                  short cinematic essays. It is designed for contemplation, not advice.
                </p>

                <div className="bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl p-5 border border-amber-200/50 dark:border-amber-800/30">
                  <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Important note
                  </h3>
                  <ul className="text-sm space-y-2.5 text-secondary">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>This is <strong className="text-primary font-semibold">not professional advice</strong> of any kind</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Interpretations are creative, not factual claims</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Use this as a starting point for reflection, not decisions</span>
                    </li>
                  </ul>
                </div>

                <p className="text-sm text-[var(--sage-500)]">
                  By continuing, you acknowledge these limitations and agree to use Orbit for reflection
                  and creative exploration.
                </p>
              </div>

              {/* Accept Button */}
              <button
                onClick={onAccept}
                className="w-full mt-8 py-4 bg-gradient-to-r from-[var(--sage-500)] to-[var(--sage-600)] 
                         hover:from-[var(--sage-600)] hover:to-[var(--sage-700)] 
                         text-white font-semibold rounded-2xl text-base
                         transition-all duration-300 ease-[var(--ease-smooth)] 
                         hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(45,54,45,0.1),0_8px_16px_rgba(45,54,45,0.15),0_24px_48px_rgba(45,54,45,0.2)]
                         hover:scale-[1.02]
                         active:shadow-inner active:scale-[0.98]
                         shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              >
                I Understand, Let's Begin
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
